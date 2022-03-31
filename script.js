// Add your access token
mapboxgl.accessToken = pk.eyJ1IjoiY2FycGVudGVyeDIwIiwiYSI6ImNsMWY1emdhZDAydWgza3Bma3RyOXplMzcifQ.gROkyI6Rw1LJouUs9GcWWQ;

const coordsText = document.getElementById("coordsText");
const parseBtn = document.getElementById("parse-button");

var markers = [];

parseBtn.addEventListener("click", ParseInput);

// Initialize a map
const map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/light-v10', // stylesheet location
    zoom: 1 // starting zoom
});

const nothing = turf.featureCollection([]);

map.on('load', async () => {

    map.addSource('route', {
        type: 'geojson',
        data: nothing
    });

    map.addLayer({
            id: 'routearrows',
            type: 'symbol',
            source: 'route',
            layout: {
                'symbol-placement': 'line',
                'text-field': '▶',
                'text-size': ['interpolate', ['linear'],
                    ['zoom'], 12, 24, 22, 60
                ],
                'symbol-spacing': ['interpolate', ['linear'],
                    ['zoom'], 12, 30, 22, 160
                ],
                'text-keep-upright': false
            },
            paint: {
                'text-color': '#3887be',
                'text-halo-color': 'hsl(55, 11%, 96%)',
                'text-halo-width': 3
            }
        },
        'waterway-label'
    );

    map.addLayer({
            id: 'routeline-active',
            type: 'line',
            source: 'route',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#3887be',
                'line-width': ['interpolate', ['linear'],
                    ['zoom'], 12, 3, 22, 12
                ]
            }
        },
        'waterway-label'
    );
});

function ParseInput() {
    let lines = coordsText.value.split("\n");
    var filtered = lines.filter(function (el) {
        return el != "";
    });
    var coords = [];
    filtered.forEach(element => {
        let textCoords = element.split(",");
        // {longitude},{latitude}
        if (textCoords.length == 2) {
            let longitude = parseFloat(textCoords[1]);
            let latitude = parseFloat(textCoords[0]);
            if (!isNaN(longitude) && !isNaN(latitude)) {
                // latitude value must be between -90 and 90
                // -180 to 180 for longitude
                if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
                    let coord = [longitude, latitude];
                    coords.push(coord);
                }
            }
        }
    });
    if (coords.length >= 2 && coords.length <= 12) {
        var bounds = new mapboxgl.LngLatBounds();

        coords.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds);

        let joinedCoords = [];
        coords.forEach(element => {
            joinedCoords.push(element.join(","));
        });
        let coordinates = joinedCoords.join(";");
        console.log(coordinates);
        NewRequest(coordinates, GetProfile("driving"), mapboxgl.accessToken);
    }
}

function GetProfile(profileName) {
    switch (profileName) {
        case "driving":
            return "mapbox/driving";
        case "walking":
            return "mapbox/walking";
        case "cycling":
            return "mapbox/cycling";
        case "traffic":
            return "mapbox/driving-traffic";
        default:
            return "mapbox/driving";
    }
}

async function NewRequest(coordinates, profile, token) {
    // Make a request to the Optimization API
    const query = await fetch(AssembleQueryURL(coordinates, profile, token), {
        method: 'GET'
    });
    const response = await query.json();
    console.log(response);

    // Create an alert for any requests that return an error
    if (response.code !== 'Ok') {
        const handleMessage =
            response.code === 'InvalidInput' ?
            'Refresh to start a new route. For more information: https://docs.mapbox.com/api/navigation/optimization/#optimization-api-errors' :
            'Try a different point.';
        alert(`${response.code} - ${response.message}\n\n${handleMessage}`);
        return;
    }
    // Create a GeoJSON feature collection
    const routeGeoJSON = turf.featureCollection([
        turf.feature(response.trips[0].geometry)
    ]);

    // remove markers 
    if (markers !== null) {
        for (var i = markers.length - 1; i >= 0; i--) {
            const marker = markers[i];
            const markerDiv = marker.getElement();

            markerDiv.removeEventListener('mouseenter', () => marker.togglePopup());
            markerDiv.removeEventListener('mouseleave', () => marker.togglePopup());
            marker.remove();
        }
    }
    markers = [];

    response.waypoints.forEach(waypoint => {
        var el = document.createElement('div');
        el.className = 'marker';
        el.innerHTML = `<span><b>${waypoint.waypoint_index + 1}</b></span>`
        const marker = new mapboxgl.Marker(el)
            .setLngLat(waypoint.location)
            .setPopup(new mapboxgl.Popup({
                closeButton: false,
                offset: [0, -10]
            }).setHTML(BuildPopupHTML(waypoint.name, waypoint.location)))
            .addTo(map);
        const markerDiv = marker.getElement();

        markerDiv.addEventListener('mouseenter', () => marker.togglePopup());
        markerDiv.addEventListener('mouseleave', () => marker.togglePopup());
        markers.push(marker);
    })

    // Update the `route` source by getting the route source
    // and setting the data equal to routeGeoJSON
    map.getSource('route').setData(routeGeoJSON);
}

function BuildPopupHTML(name, location) {
    if (name != "") {
        return `<b>${name}</b><br>Latitude: ${location[1]}<br>Longitude: ${location[0]}`;
    } else {
        return `Latitude: ${location[1]}<br>Longitude: ${location[0]}`;
    }

}

// Here you'll specify all the parameters necessary for requesting a response from the Optimization API
function AssembleQueryURL(coordinates, profile, token) {
    return `https://api.mapbox.com/optimized-trips/v1/${profile}/${coordinates}?&overview=full&steps=true&geometries=geojson&roundtrip=false&source=first&destination=last&access_token=${token}`;
}