"use strict";
/*jslint browser: true*/
/*global Tangram, gui */

// initialize variables
var newimg, oldData, size = 250;

// set sizes
document.getElementById("map").style.height = size+"px";
document.getElementById("map").style.width = size+"px";

document.getElementById("old").style.height = size+"px";
document.getElementById("old").style.width = size+"px";

document.getElementsByClassName("container")[0].style.height = size+"px";
document.getElementsByClassName("container")[0].style.width = size+"px";


var map = (function () {
    var map_start_location = [40.70531887544228, -74.00976419448853, 15]; // NYC

    /*** URL parsing ***/

    // leaflet-style URL hash pattern:
    // #[zoom],[lat],[lng]
    var url_hash = window.location.hash.slice(1, window.location.hash.length).split('/');

    if (url_hash.length == 3) {
        map_start_location = [url_hash[1],url_hash[2], url_hash[0]];
        // convert from strings
        map_start_location = map_start_location.map(Number);
    }

    /*** Map ***/

    var map = L.map('map', {
        keyboardZoomOffset : .05,
        zoomControl: false,
        attributionControl : false
    });

    var layer = Tangram.leafletLayer({
        scene: 'scene.yaml',
        // highDensityDisplay: false
    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    // setView expects format ([lat, long], zoom)
    map.setView(map_start_location.slice(0, 3), map_start_location[2]);

    var hash = new L.Hash(map);

    layer.addTo(map);
    
    return map;

}());

// load an image asynchronously with a Promise
function loadImage (url, target) {
    return new Promise(function(resolve, reject) {
        var image = target || new Image();
        image.onload = function() {
            resolve({ url: url, image: image });
        };
        image.onerror = function(error) {
            reject({ url: url, error: error });
        };
        image.crossOrigin = 'anonymous';
        image.src = url;
    });
}

// set up canvases

// make canvas for the old image
var oldcanvas = document.createElement('canvas');
oldcanvas.height = size;
oldcanvas.width = size;
var oldCtx = oldcanvas.getContext('2d');

// make a canvas for the newly-drawn map image
var newcanvas = document.createElement('canvas');
newcanvas.height = size;
newcanvas.width = size;
var newCtx = newcanvas.getContext('2d');

// make a canvas for the diff
var diffcanvas = document.createElement('canvas');
diffcanvas.height = size;
diffcanvas.width = size;
var diffCtx = diffcanvas.getContext('2d');
var diff = diffCtx.createImageData(size, size);

// load the old image
var oldimg = new Image();
function loadOld (img) {
    return loadImage(img).then(function(result){
        // set the old image to be drawn to the canvas once the image loads
        oldimg = result.image;
        oldCtx.drawImage(oldimg, 0, 0, oldimg.width, oldimg.height, 0, 0, oldcanvas.width, oldcanvas.height);

        // make the data available to pixelmatch
        oldData = oldCtx.getImageData(0, 0, size, size);

        return result;
    });
};

// take a screenshot
function screenshot () {
    return scene.screenshot().then(function(data) {
        // save it to a file
        // saveAs(data.blob, 'tangram-' + (+new Date()) + '.png');

        var urlCreator = window.URL || window.webkitURL;
        newimg = new Image();
        return loadImage(urlCreator.createObjectURL( data.blob ), newimg);
    });
};

// perform the image comparison
function doDiff() {

    // save the new image to the new canvas, stretching it to fit (in case it's retina)
    newCtx.drawImage(newimg, 0, 0, newimg.width, newimg.height, 0, 0, newcanvas.width, newcanvas.height);
    // make the data available
    var newData = newCtx.getImageData(0, 0, size, size);

    // run the diff
    pixelmatch(newData.data, oldData.data, diff.data, size, size, {threshold: 0.1});

    // put the diff in its canvas
    diffCtx.putImageData(diff, 0, 0);

    // make imgs for new, old, and diff and attach them to the document
    newimg.width = size;
    newimg.height = size;
    document.getElementById("new").insertBefore( newimg, document.getElementById("new").firstChild );

    oldimg.width = size;
    oldimg.height = size;
    document.getElementById("old").insertBefore( oldimg, document.getElementById("old").firstChild );

    var diffimg = document.createElement('img');
    diffimg.src = diffcanvas.toDataURL("image/png");
    document.getElementById("diff").insertBefore( diffimg, document.getElementById("diff").firstChild );
    
};


var views = [
    ['http://localhost:7000/eraser-map.yaml', 48.86110101269274, 2.361373901367188, 11],
    ['https://raw.githubusercontent.com/tangrams/tangram-sandbox/gh-pages/styles/tron.yaml', 40.7139883550567, -74.00600910186769, 15],
    ['https://raw.githubusercontent.com/tangrams/tangram-sandbox/gh-pages/styles/blueprint.yaml', 51.50286581276559,-0.12119293212890626,14],
    ['http://localhost:7000/eraser-map.yaml', 35.68518697509636,139.75725173950198,15],
    ['https://raw.githubusercontent.com/tangrams/tangram-sandbox/gh-pages/styles/tron.yaml', 47.604774168947614,-122.28607177734376,11],
    ['https://raw.githubusercontent.com/tangrams/tangram-sandbox/gh-pages/styles/blueprint.yaml', 41.89075864654001,12.487063873882976,17]
];
var v;

function nextView () {
    v = v || 0;
    if (v < views.length) {
        var view = views[v];
        if (scene.config_path !== view[0]) {
            scene.load(view[0]).then(function() {
                map.setView([view[1], view[2]], view[3]);
                scene.requestRedraw();
                v++;
            });
        }
        else {
            map.setView([view[1], view[2]], view[3]);
            scene.requestRedraw();
            v++;
        }
    }
}

scene.subscribe({
    view_complete: function () {
        if (!(v > views.length)) {
            Promise.all([screenshot(),loadOld('tangram-1452283152715.png')]).then(function() {
                doDiff();
                nextView();
            });
        }
    }
});