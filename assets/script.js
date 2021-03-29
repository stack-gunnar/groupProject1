// Global Variables
var mapDiv = $("#map");
var searchInp = $("#search-input");
var destBtnCont = $("#destination-btn-container");
var destPic = $("#dest-img");
var destName = $("#dest-name");
var destAddr = $("#dest-addr");
var destSite = $("#dest-site");
var calcRoute = $("#calc-route");
var directDiv = $("#directions");
var qrPic = $("#qr-pic");
var routeAlert = $("#route-alert");

var mapOG;
var destList = {};
var orderInputted = [];


// Global Services
let directServ;
let dirRenderServ;

// Save API key
var apiKey = localStorage.getItem("apiKey");
if (apiKey === null || apiKey === "null") {
  apiKey = prompt("Enter the API key: ");
  localStorage.setItem("apiKey", apiKey);
}

// Create the script tag, set the appropriate attributes
// This initializes the google maps API thing
var script = document.createElement("script");
script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
script.async = true;

// Append the 'script' element to 'head'
document.head.appendChild(script);


// Callback to run after google maps API runs; intialize map
function initMap() {
  // Create map
  mapOG = new google.maps.Map(mapDiv[0], {
    center: { lat: 44.977753, lng: -93.2650108 },
    zoom: 8,
  });

  // Autocomplete search options
  const autoCompOpt = {
    fields: ["formatted_address", "geometry", "name", "photos", "place_id", "website"],
    origin: mapOG.getCenter(),
    strictBounds: false,
  };

  // Create services
  const autoCompServ = new google.maps.places.Autocomplete(searchInp[0], autoCompOpt);
  directServ = new google.maps.DirectionsService();
  dirRenderServ = new google.maps.DirectionsRenderer();
  autoCompServ.bindTo("bounds", mapOG);


  // Event listener for search
  autoCompServ.addListener("place_changed", () => {
    // Get the place object for what was searached
    const place = autoCompServ.getPlace();

    // Make sure it's an actual place
    if (!place.geometry || !place.geometry.location) {
      // User entered the name of a Place that was not suggested and
      // pressed the Enter key, or the Place Details request failed.

      // TODO: replace with modal
      window.alert(`No details available for input: '${place.name}'`);
      return;
    }
    // Clear search input value
    searchInp.val("");
    // Add destination to variables and handle things with it
    addDestination(place, mapOG);
  });
}

// Handle place data
function addDestination(placeInp, mapInp) {
  // If the place has a geometry, then present it on a map.
  if (placeInp.geometry.viewport) {
    mapInp.fitBounds(placeInp.geometry.viewport);
  } else {
    mapInp.setCenter(placeInp.geometry.location);
    mapInp.setZoom(17);
  }

  // Create marker
  const placeMark = new google.maps.Marker({
    position: placeInp.geometry.location
  });
  placeMark.setMap(mapOG);

  // Create new button for this destination
  const btnDiv = $("<div>")
    .addClass("my-4");

  const newBtn = $("<button>")
    .addClass("btn btn-primary mr-2")
    .text(placeInp.name)
    .attr("data-placeid", placeInp.place_id);

  const delBtn = $("<button>")
    .addClass("btn btn-danger bold px-2")
    .text("X");

  btnDiv.append(newBtn, [delBtn]);
  destBtnCont.append(btnDiv);

  // Build destination object
  const destination = {
    place: placeInp,
    marker: placeMark,
    button: newBtn,
    deleteButton: delBtn
  };

  destList[placeInp.place_id] = destination;
  orderInputted.push(placeInp.place_id);
  fillDestData(destination.place);
  updateRouteBtn();
}

// Update screen with information from data
function fillDestData(clickedDestPlace) {
  if (clickedDestPlace.photos) {
    destPic.attr("src", clickedDestPlace.photos[0].getUrl());
  } else {
    destPic.attr("src", "assets/Roadtrippers.png");
  }

  destName.text(clickedDestPlace.name);
  destAddr.text(clickedDestPlace.formatted_address);
  if (clickedDestPlace.website) {
    destSite.removeClass("disabled");
    destSite.attr("href", clickedDestPlace.website);
  } else {
    destSite.attr("href", "#");
    destSite.addClass("disabled");
  }
}

// Disable get route if not enough destinations
function updateRouteBtn() {
  console.log(orderInputted.length);
  if (orderInputted.length < 2) {
    // Disable button
    calcRoute.attr("disabled", "disabled");
  } else {
    calcRoute.removeAttr("disabled");
  }
}

// Hide no destination alert warning; close
routeAlert.on("click", "button", (event) => {
  event.preventDefault();
  routeAlert.removeClass("show");
  setTimeout(() => {
    routeAlert.addClass("d-none");
  }, 200);
});

// Show danger alert for bad route
function routeAlertShow() {
  routeAlert.removeClass("d-none");
  routeAlert.addClass("show");
}

// Destination buttons
destBtnCont.on("click", "button", (event) => {
  if ($(event.currentTarget).hasClass("btn-primary")) {
    // Get place object from clicked button
    const clickedPlaceId = event.currentTarget.dataset.placeid;
    const clickedDestPlace = destList[clickedPlaceId].place;
    mapOG.panTo(clickedDestPlace.geometry.location);
    fillDestData(clickedDestPlace);
    // Fill in destination data given place information
  } else {
    // X button clicked
    const removedPID = $(event.currentTarget).siblings()[0].dataset.placeid;
    destList[removedPID].marker.setMap(null);
    destList[removedPID].marker = null;
    delete destList[removedPID];
    orderInputted.splice((orderInputted.indexOf(removedPID)), 1);
    $(event.currentTarget).parent().remove();
    updateRouteBtn();
  }
});

// Calculate the route
calcRoute.on("click", (event) => {
  const routeReq = {
    origin: { placeId: orderInputted[0] },
    destination: { placeId: orderInputted[orderInputted.length - 1] },
    travelMode: google.maps.TravelMode.DRIVING,
    optimizeWaypoints: true,
    waypoints: []
  };

  // Get information needed for url
  const waypointNames = [];
  const waypointPIDs = [];

  const originPID = routeReq.origin.placeId;
  const originObj = destList[originPID];

  const destinPID = routeReq.destination.placeId;
  const destinObj = destList[destinPID];

  // Go through all destinations, if it's not origin or destination, it must be waypoint
  Object.keys(destList).forEach((pId) => {
    if ((pId !== routeReq.origin.placeId) && (pId !== routeReq.destination.placeId)) {
      // Destination is a waypoint
      routeReq.waypoints.push({ location: { placeId: pId } });
      waypointNames.push(destList[pId].place.name);
      waypointPIDs.push(pId);
    }
  });


  dirRenderServ.setMap(mapOG);
  dirRenderServ.setPanel(directDiv[0]);

  directServ.route(routeReq, (result, status) => {
    if (status !== "OK") {
      // Error getting route, so display the alert
      routeAlertShow();
    }
    dirRenderServ.setDirections(result);
  });

  // Build the url for API fetches
  let gMapUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originObj.place.name)}&origin_place_id=${encodeURIComponent(originPID)}&destination=${encodeURIComponent(destinObj.place.name)}&destination_place_id=${encodeURIComponent(destinPID)}`;
  let waypointEncodedURL = "";

  if (routeReq.waypoints.length > 0) {
    waypointEncodedURL = `&waypoints=${encodeURIComponent(waypointNames.join("|"))}&waypoint_place_ids=${encodeURIComponent(waypointPIDs.join("|"))}`;
    gMapUrl += waypointEncodedURL;
  }
  // Make url for QR code
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(gMapUrl)}&size=200x200`;
  qrPic.attr("src", qrUrl);
});