/* global google */
/* global _ */
/**
 * scripts.js
 *
 * MilitaryFinder
 * 
 *
 * Global JavaScript.
 * 
 * Based on Distribution Code for Harvard CS50 Problem Set 8.
 * 
 */

// Google Map
var map;

// markers for map
var markers = [];

// info window
var info = new google.maps.InfoWindow();

// clusterer to group markers per http://google-maps-utility-library-v3.googlecode.com/svn/tags/markerclustererplus/2.0.14/
var clusterManager;

// overlapping marker spiderfier (spiderwebs out overlapping markers like in Google Earth)
var spiderfier;

// globally track if user is on mobile phone or not
var mobileStatus;

// globally track the currently selected marker
var selectedMarker;
var selectedMarkerInfo;

// globally track if typeahead item was just selected (needed to prevent selected marker from being removed)
var typeaheadSelected = false;

// track dialog is open
var locationErrorDragMode = false;

// track number of requests
var ajaxRequests = 0;

// track if query from url was successfully found in database (if so, don't center map w/ geolocation)
var urlQuerySuccessful = false;

// execute when the DOM is fully loaded; geolocates and loads map
$(function() {

    // styles for map
    // https://developers.google.com/maps/documentation/javascript/styling
    var styles = [

        // show Google's labels
        {
            featureType: "all",
            elementType: "labels",
            stylers: [
                {visibility: "on"}
            ]
        },

        // show roads
        {
            featureType: "road",
            elementType: "geometry",
            stylers: [
                {visibility: "on"}
            ]
        }

    ];

    // variables to track initial location and if browser supports geolocation
    var browserSupportFlag;
    var initialLocation
    
    // Try W3C Geolocation to center map on user location, idea from https://developers.google.com/maps/articles/geolocation
    if(navigator.geolocation) 
    {
        
        // browser support, track with bool
        browserSupportFlag = true;

        // get current position, if failed handle
        navigator.geolocation.getCurrentPosition(function(position) {
            
            // set initial location if function worked
            initialLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
            
            // as long as there wasn't a successful urlQuery (which recenters the map itself)
            if (urlQuerySuccessful === false) {
                
                // center map on location
                map.setCenter(initialLocation);
                
                // update map in case map already loaded
                update();
            
            }
            
            // log to console
            console.log("Geolocation successful");
        }, function() {
                
                // handle error if failed
                handleNoGeolocation(browserSupportFlag);
        });
    }
  
    // browser doesn't support Geolocation
    else
    {
        browserSupportFlag = false;
        handleNoGeolocation(browserSupportFlag);
    }

    function handleNoGeolocation(errorFlag)
    {
        
        // if browser supported but still failed
        if (errorFlag == true) 
        {
            
            // log to console
            console.log("Geolocation service failed.");
            
        }
        
        // browser didn't support
        else 
        {
            
            // log to console
            console.log("Browser doesn't support geolocation.");
            
        }
    }

    // options for map
    // https://developers.google.com/maps/documentation/javascript/reference#MapOptions
    var options = {
        disableDefaultUI: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        center: {lat: 35.141808, lng: -78.995359}, // Fort Bragg
        maxZoom: 20,
        panControl: true,
        styles: styles,
        zoom: 13,
        zoomControl: true
    };

    // get DOM node in which map will be instantiated
    var canvas = $("#map-canvas").get(0);

    // instantiate map
    map = new google.maps.Map(canvas, options);
    
    // both clusterer and spiderfier need to be up here because their methods are called
    // when configuring the map; otherwise will get errors in console
    // clusterer to manage any items that are too close together
    clusterManager = new MarkerClusterer(map, markers);
    
    // configuration for spiderfier
    var spiderfierOptions = { 
        
        // save memory by not having spiderfier prepare for potential moves/hides
        markersWontMove: true, 
        markersWontHide: true,
        
        // keep cluster "spiderwebbed" out after user clicks to make items easier for user to sort through
        keepSpiderfied: true,
    };
    
    // make global spiderfier
    spiderfier = new OverlappingMarkerSpiderfier(map, spiderfierOptions);

    // configure UI once Google Map is idle (i.e., loaded)
    google.maps.event.addListenerOnce(map, "idle", configure);
    
    // determine is user on mobile
    mobileStatus = mobileCheck();
    
});


/**
 * Adds marker for place to map.
 */
function addMarker(place)
{
    
    // determine icon for marker
    var placeIcon = iconLookup(place);
    
    // create a new marker
    var marker = new MarkerWithLabel({
        
        // set position from position column from database row; convert lat/long to number
        position: {lat: Number(place["latitude"]), lng: Number(place["longitude"])},
        
        // do not allow user to drag
        draggable: false,

        map: map,
        
        // label with city and state
        labelContent: place["installation"] + " " + place["title"],
        
        // assign icon
        icon: placeIcon,
        
        // label invisible by default to prevent messy overlapping
        labelVisible: false,
        
        // styling for label
        labelAnchor: new google.maps.Point(0, 0),
        labelClass: "label", // the CSS class for the label
        labelStyle: {opacity: 0.75}
        
     });
     
    // add marker to spidifier
    spiderfier.addMarker(marker);
    
    // add marker to clusterer
    clusterManager.addMarker(marker);
     
    // push marker to array
    markers.push(marker);
    
    // detect user click
    marker.addListener('click', function() {
        
        // get content for info window
        var content = getContent(place);
        
        // globally track info for selected location
        selectedMarkerInfo = place;        
        
        // open window with content
        showInfo(marker, content);
        
        // identify selected marker
        selectedMarker = this;
        
        // show label on marker just clicked
        marker.set("labelVisible", true);
    
    });
    
    // function to hide marker label
    function hideLabel() { 
        marker.set("labelVisible", false); 
    }
    
    // when info window is moved (as when another marker is clicked), hide label again
    google.maps.event.addListener(info, 'content_changed', hideLabel);
    
    // when info window is closed, hide label again
    google.maps.event.addListener(info, 'closeclick', hideLabel);
    
    return marker;
    
}

/**
 * Configures application.
 */
function configure()
{
    
    // update UI after map has been dragged
    google.maps.event.addListener(map, "dragend", function() {
        update();
    });

    // update UI after zoom level changes
    google.maps.event.addListener(map, "zoom_changed", function() {
        
        // only update if typeahead hasn't just been selected (will update already if selected)
        if (typeaheadSelected == false) {
            update();
        }
    });

    // remove markers whilst dragging
    // un-spiderfy markers while dragging maps
    google.maps.event.addListener(map, "dragstart", function() {
        removeMarkers();
        spiderfier.unspiderfy();
        
        // make it so marker is no longer selected so it gets added to map during subsequent update
        selectedMarkerInfo = undefined;
    });
    
    
    // if on mobile device, take away keyboard when map is clicked by focusing on copyright instead
    if(mobileStatus == true) {
        
        google.maps.event.addListener(map, "click", function() {
            $("#q").blur();
        });
    }

    // configure typeahead
    // https://github.com/twitter/typeahead.js/blob/master/doc/jquery_typeahead.md
    $("#q").typeahead({
        autoselect: true,
        highlight: true,
        minLength: 1
    },
    {
        source: search,
        templates: {
            notfound: "Sorry, no matches!",
            empty: "No places found yet...",
            suggestion: _.template("<p class=\".tt-suggestion\"><%- title %>, <%- address_line1 %>, <%- city %></p><hr>"),
        }
    });

    // re-center map after place is selected from drop-down
    $("#q").on("typeahead:selected", function(eventObject, suggestion) {
        typeaheadOrUrlSelect(suggestion);
    });

    // hide info window when text box has focus
    $("#q").focus(function(eventData) {
        hideInfo();
    });

    // re-enable ctrl- and right-clicking (and thus Inspect Element) on Google Map
    // https://chrome.google.com/webstore/detail/allow-right-click/hompjdfbfmmmgflfjdlnkohcplmboaeo?hl=en
    document.addEventListener("contextmenu", function(event) {
        event.returnValue = true; 
        event.stopPropagation && event.stopPropagation(); 
        event.cancelBubble && event.cancelBubble();
    }, true);
    
    // update UI
    update();

    // give focus to text box if user not on mobile
    if(mobileStatus == false) {
        $("#q").focus();
    }
    
    // max zoom above which markers are no longer clustered (allows spiderfier to
    // take over for precise user selection at higher zoom levels)
    clusterManager.setMaxZoom(14);
    
    // hide about us to prevent a bug where it shows on bottom of screen after moving error report window that was
    // past bottom of screen
    $("#dialog-message").hide();
    
    // hide error form to make clearing markers work properly
    $("dialog-form").hide();
    
    // call about us info window when about us is clicked
    $( "#aboutUs" ).click(displayAbout);
    
    // listen for clicks on drag to report error button
    $("#dragToReportButton").click(dragToReport);
    
    // if a query is present in URL, update map accordingly
    updateFromQuery();
}

/**
 * Hides info window.
 */
function hideInfo()
{
    info.close();
}

/**
 * Removes markers from map.
 */
function removeMarkers()
{
    
    // clear all markers normally
    if (locationErrorDragMode == false && typeaheadSelected == false) {
        clusterManager.clearMarkers();
        spiderfier.clearMarkers();
        
        // clear array by setting to null
        var markersLength = markers.length;
    
        for (var i = 0; i < markersLength; i++) {
            markers[i].setMap(null);
        }
        
        // empty array
        markers = [];
        
    }
    
    // this time don't delete the selected marker
    // did this in an if / else loop so that you don't have to check
    // status typeahead and error reporting each time
    else {
    
        // clear spiderfier
        spiderfier.clearMarkers();
        
        // clear the markers by setting to null
        markersLength = markers.length;
        
        for (var i = 0; i < markersLength; i++) {
            
            // if marker is currently selected
            if (markers[i] === selectedMarker) {
                
                // remove element from array so it is not cleared from map
                markers.splice(i, 1);
                
                // update length since array is shorter now
                markersLength--;
                
                // reset index since moved everything back one spot
                i--;
                
                continue;
            }
            
            markers[i].setMap(null);
            
        }
        
        // remove clusters from map
        clusterManager.removeMarkers(markers);
        
        // empty the array
        markers = [];
    
        // put back on array since marker still out there
        markers.push(selectedMarker);
        
    }
    
    // reset typeahead selected (we want ALL markers-including those selected from typeahead-to be deleted in future updates
    // just not during the first update after being first selected)
    typeaheadSelected = false;

}

/**
 * Searches database for typeahead's suggestions.
 */
function search(query, cb)
{
    // get current map location for geo-relevent results
    var location = map.getCenter();
    var lat = location.lat();
    var long = location.lng();
    
    // translate user input to search converting acronyms, etc.
    query = formatQuery(query);
    
    // get places matching query (asynchronously)
    var parameters = {
        geo: query,
        map_lat: lat,
        map_long: long,
    };
    $.getJSON("search.php", parameters)
    .done(function(data, textStatus, jqXHR) {

        // call typeahead's callback with search results (i.e., places)
        cb(data);
    })
    .fail(function(jqXHR, textStatus, errorThrown) {

        // log error to browser's console
        console.log(errorThrown.toString());
    });
}

/**
 * Shows info window at marker with content and allows error reporting if needed.
 */
function showInfo(marker, content)
{
    
    // start div
    var div = "<div id='info'>";
    if (typeof(content) === "undefined")
    {
        // http://www.ajaxload.info/
        div += "<img alt='loading' src='img/ajax-loader.gif'/>";
    }
    else
    {
        div += content;
    }

    // end div
    div += "</div>";

    // set info window's content
    info.setContent(div);

    // open info window (if not already open)
    info.open(map, marker);
    
    // if report error button is clicked, open error form
    $( "#report-error" ).button().on( "click", function() {
        displayForm();
    });
    
}

/**
 * Updates UI's markers.
 */
function update() 
{

    // don't update map if user is dragging pin to report an error (don't want to put other markers on map)
    if (locationErrorDragMode == true) {
        return;
    }
    
    // remove markers
    removeMarkers();
    
    // get map's bounds
    var bounds = map.getBounds();
    var ne = bounds.getNorthEast();
    var sw = bounds.getSouthWest();

    // get places within bounds (asynchronously)
    var parameters = {
        ne: ne.lat() + "," + ne.lng(),
        q: $("#q").val(),
        sw: sw.lat() + "," + sw.lng()
    
    };
    
    function sendRequest() {
        
        var queueNumber = ++ajaxRequests;
        
        $.getJSON("update.php", parameters)
        .done(function(data, textStatus, jqXHR) {
    
            // http://stackoverflow.com/questions/446594/abort-ajax-requests-using-jquery
            // this is a closure because the outer function will return while waiting on inner function
            // but inner function still has access to it
            // only add markers if this is the most recent request
            if (queueNumber === ajaxRequests) {
                
                // add new markers to map
                for (var i = 0; i < data.length; i++)
                {
                    
                    // don't add marker if already selected (and hence already on map)
                    if (typeof selectedMarkerInfo !== 'undefined' && selectedMarkerInfo.id === data[i].id)
                    {
                        continue;
                    }
        
                    addMarker(data[i]);    
                }
                
                // reset number of ajax requests
                ajaxRequests = 0;
            }
            
         })
         .fail(function(jqXHR, textStatus, errorThrown) {
    
             // log error to browser's console
             console.log(errorThrown.toString());
         });
    }
    
    sendRequest();
     
    // if on mobile device, take away keyboard when map is updated by focusing on copyright instead
    if(mobileStatus == true) {
        $("#q").blur();
    }
     
}

/**
 * Gets content for the info window.
 */
function getContent(place) 
{    
    
    // variable for content, open address tag
    var content = '<address>';
    
    // bold place name
    content += '<strong>' + place["title"] + '</strong><br>';
    
    // fields to print in info window
    var fields = ["address_line1", "address_line2", "directory", "city", "commercial_phone1"];
    
    // track array length for loop
    var length = fields.length;
    
    // loop over each field building html ul    
    for (var i = 0; i < length; i++) {
        if(place[fields[i]] != '') {
            content += place[fields[i]] + '<br>';
        }
    }
    
    // if there is a web site in the database, make hyperlink
    if(place['web_site_address1'] != '') {
        content += '<a href="' + place['web_site_address1'] + '">' + "Visit Website" + "</a><br>";
    }
    
    // button to get directions
    content += '<div class="text-center"><div class="btn-group" role="group"><button id="directionsButton" type="button" class="btn btn-primary btn-xs"' +
        'onclick="getDirections(' + place["latitude"] + ', ' + place["longitude"] + ')">Get Directions</button>';
    
    // clickable button to report error
    content += '<button id="report-error" type="button" class="btn btn-danger btn-xs">Report Error</button></div></div>' +
        '</address>';
        
    return content;
}


/**
 * Gets driving directions.
 */
function getDirections(latitude, longitude)
{
    
    // open a google maps directions window to those coordinates
    window.open("https://www.google.com/maps/dir//" + latitude + "," + longitude);
}


/**
 * Determines icon for each place.
 */
function iconLookup(place) 
{
    
    // icons for markers
    // http://www.lass.it/Web/viewer.aspx?id=4
    // https://mapicons.mapsmarker.com/
    var icons = {
        place: "../img/rangerstation.png",
        automotive: "../img/cabs.png",
        education: "../img/school.png",
        chapel: "../img/chapel.png",
        gym: "../img/weights.png",
        commissary: "../img/convienancestore.png",
        children: "../img/nursery.png",
        kids: "../img/kids.png",
        barber: "../img/barber.png",
        other: "../img/blue.png",
        mwr: "../img/hiker.png",
        golf: "../img/golfer.png",
        medical: "../img/hospitals.png",
        bank: "../img/bank.png",
        transportation: "../img/truck.png",
        housing: "../img/house.png",
        info: "../img/info.png",
        law: "../img/court.png",
        police: "../img/police.png",
        personnel: "../img/reception.png",
        socialServices: "../img/social_service.png",
        military: "../img/military.png"
    };
    
    // check place to see if match amongst icons above
    if (place["directory"] == "Location")
    {
        return(icons["place"]);
    }
    
    else if (place["directory"] == "Civilian Personnel Office" || place["directory"] == "Non-appropriated Funds (NAF) Human Resources")
    {
        return(icons["personnel"]);
    }
    
    else if (place["directory"] == "EFMP - Family Support" || place["directory"] == "Emergency Relief Services" ||
        place["directory"] == "Family Advocacy Program" || place["directory"] == "EFMP - Enrollment")
    {
        return(icons["socialServices"]);
    }
    
    else if (place["directory"] == "Child Development Centers" || place["directory"] == "Family Center" 
        || place["directory"] == "Family Child Care/Child Development Homes" || place["directory"] == "New Parent Support Program")
    {
        return(icons["children"]);
    }
    
    else if (place["directory"] == "Youth Programs/Centers" || place["directory"] == "Child and Youth Registration and Referral")
    {
        return(icons["kids"]);
    }
    
    else if (place["directory"] == "Adult Education Centers" || place["directory"] == "DoD Schools" || 
        place["directory"] == "School Liaison Office/Community Schools" ||
        place["directory"] == "Spouse Education, Training and Careers")
    {
        return(icons["education"]);
    }
    
    else if (place["directory"] == "MWR (Morale Welfare and Recreation)")
    {
        return(icons["mwr"]);    
    }
    
    else if (place["directory"] == "Financial Institutions" || place["directory"] == "Loan Closet" 
        || place["directory"] == "Personal Financial Management Services")
    {
        return(icons["bank"]);
    }
    
    else if (place["directory"] == "Beauty/Barber Shops")
    {
        return(icons["barber"]);
    }
    
    else if (place["directory"] == "Chapels")
    {
        return(icons["chapel"]);
    }
    
    else if (place["directory"] == "Commissary/Shoppette" || place["directory"] == "Exchange(s)")
    {
        return(icons["commissary"]);
    }
    
    else if (place["directory"] == "Gymnasiums/Fitness Centers")
    {
       return(icons["gym"]);
    }
    
    else if (place["directory"] == "Golf Courses")
    {
        return(icons["golf"]);
    }
    
    else if (place["directory"] == "Hospitals/Medical Treatment Facility(s)" || place["directory"] == "Dental Clinics")
    {
        return(icons["medical"]);
    }
    
    else if (place["directory"] == "Automotive Services")
    {
        return(icons["automotive"]);
    }
    
    else if (place["directory"] == "Housing Office/Government Housing")
    {
        return(icons["housing"]);
    }
    
    else if (place["directory"] == "Household Goods/Transportation Office (inbound)" 
        || place["directory"] == "Household Goods/Transportation Office (outbound)"
        || place["directory"] == "Relocation Assistance Program")
    {
        return(icons["transportation"]);
    }
    
    else if (place["directory"] == "Welcome/Visitors Center" || place["directory"] == "Information and Referral Services")
    {
        return(icons["info"]);
    }
    
    else if (place["directory"] == "Legal Services/JAG")
    {
        return(icons["law"]);
    }
    
    else if (place["directory"] == "Law Enforcement")
    {
        return(icons["police"]);
    }
    
    else if (place["directory"] == "Deployment/Mobilization")
    {
        return(icons["military"]);
    }
    
    // if no match
    else
    {
        return(icons["other"]);
    }

}

/**
 * Displays a form for reporting errors; calls a PHP script to log errors in
 * database.
 */
function displayForm ()
{
    
    // variables for form
    var errorDialog;
    var tips = $(".validateTips");
    var selector = $("select");
    var selectedOption;
    
    var errorForms = {
        locationError: {
            DOM: $("#locationError"),
            "street": {
                DOM: $("#inputStreet"),
                response: "Please input a valid street address.",
                regex: /^\s*\S+(?:\s+\S+){2}/,
            },
            
            "city": {
                DOM: $("#inputCity"),
                response: "Please input a valid city, between 3 and 50 characters.",
                regex: /^[a-zA-Z]{3,50}$/,
            },
            
            "state": {
                DOM: $ ("#inputState"),
                response: "Please provide a valid 2 digit state abbreviation",
                regex: /^[A-Z]{2}$/,
            },
            
            "zip": {
                DOM: $("#inputZip"),
                response: "Please provide a valid 5 digit zip code.",
                regex: /^[0-9]{5}$/,
            },
        },

        phoneError: {
            DOM: $("#phoneError"),            
            "phone": {
                DOM: $("#inputPhone"),
                response: "Please provide a valid phone number.",
                
                // http://stackoverflow.com/questions/16699007/regular-expression-to-match-standard-10-digit-phone-number
                regex: /^\s*(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?\s*$/,
            }
        },
        
        titleError: {
            DOM: $("#titleError"),            
            "title": {
                DOM: $("#inputTitle"),
                response: "Please provide a valid title.",
                
                // all alpha characters
                regex: /^[a-z\d\-_\s]+$/i,
            }
        },
    }
    
    // set DOM elements to non enumerable to prevent them being looped on for in loops
    for (var form in errorForms) {
        errorForms[form] = Object.defineProperty(errorForms[form], "DOM", {enumerable: false});
    }

    // hide unselected forms by default
    for (var form in errorForms) {
        errorForms[form].DOM.hide();
    }
    
    // hide tips
    tips.hide();
    
    // when functions are selected from drop down menu
    selector.change(function() {
        
        // get value that was selected
        selectedOption = selector.val();
        
        // loop through possibilities to see what was selected
        for (var form in errorForms) {
            
            // hide all so that multiple forms don't show
            errorForms[form].DOM.hide();
            
            // if found
            if (selectedOption == form)
            {
                
                // show the selected option
                errorForms[form].DOM.show();
            }   
        }
        
    });
    
    
    // check the given item for correctness
    function checkInput(item) {
        
        // variables for item being checked
        var regex;
        var response;
        
        // set from object properties
        regex = errorForms[selectedOption][item].regex;
        response = errorForms[selectedOption][item].response;
            
        // test input against regex (get value from DOM element)
        var testStatus = regex.test(errorForms[selectedOption][item].DOM.val());
        
        // if failed test
        if (!testStatus) {
            updateTips(response);
            return false;
        }
        
        // if passed test
        else {
            return true;
        }
    }
    
    function updateTips(tip) {
        tips
            .text(tip)
            .addClass("ui-state-highlight");
        setTimeout(function() {
          tips.removeClass ("ui-state-highlight", 1500);
        }, 500);
        
        // show tips
        tips.show();
    }
    
    // function for error submission
    function submitError() {
        
        // track status of checks
        var valid = true;
        
        // array for parameters to send to database
        var parameters
        
        // do stuff depending on form
        for (var inputLine in errorForms[selectedOption]) {
            valid = valid && checkInput(inputLine);
        }
        
        // if valid, add to database
        if (valid)
        {
            
            // if location error
            if (selectedOption == "locationError") {
                
                // build request parameters
                parameters = {
                    formType: "locationError",
                    id: selectedMarkerInfo["id"],
                    address_line1: errorForms.locationError.street.DOM.val(),
                    city: errorForms.locationError.city.DOM.val(),
                    state: errorForms.locationError.state.DOM.val(),
                    zip_code: errorForms.locationError.zip.DOM.val(),
                };
            }
            
            // if phone error
            if (selectedOption == "phoneError") {
                
                // build parameters
                parameters = {
                    formType: "phoneError",
                    id: selectedMarkerInfo["id"],
                    phone: errorForms.phoneError.phone.DOM.val()
                };
            }
            
            // if title error
            if (selectedOption == "titleError") {
                
                // build parameters
                parameters = {
                    formType: "titleError",
                    id: selectedMarkerInfo["id"],
                    title: errorForms.titleError.title.DOM.val()
                };
                
            }
            
            // AJAX request to report error
            $.get("reportError.php", parameters);
        
            // close dialog box
            errorDialog.dialog( "close" );
            
            // thank the user for the input
            notifyUser("Error Report Submitted", "Thanks for the feedback!", 2000);
            
            // reset selector
            selector.val("default");
            
            // reset form
            $("#" + selectedOption).trigger("reset");
            
        }
        
    }
    
    // configure error dialog form
    errorDialog = $("#dialog-form").dialog({
        autoOpen: false,
        resizable: false,
        modal: true,
        buttons: {
            "Submit": submitError,
            Cancel: function() {
                errorDialog.dialog( "close" );
            }
        },
    
        open: function () {
            
            // hide scroll only on desktop; scroll is needed on mobile
            if (mobileStatus == false) {
                errorDialog.css('overflow', 'hidden'); //this line does the actual hiding
            }
        },
        
        close: function() {
            
            // reset selector to default
            selector.val("default");
        }

    });
  
    // actions to take if submitted without clicking the button (if submitted via keyboard); applies to all forms
    errorDialog.find( "form" ).on( "submit", function( event ) {
        event.preventDefault();
        submitError();
    });
    
    // check for mobile
    if (mobileStatus == true) {
        
        // readjust height for smaller display
        $( "#dialog-form" ).dialog( "option", "height", 225 );
    
        // move to top of screen, higher values in "top-number" part move closer to top of screen
        $( "#dialog-form" ).dialog( "option", "position", { my: "top-235", at: "center", of: "#map-canvas" } );
    }
    
    // open modal form
    errorDialog.dialog( "open" );
}

/**
 * Let the user drag the icon to report a different location
 */
function dragToReport() 
{
    
    // change behavior of other functions
    locationErrorDragMode = true;
    
    // variable to store info window content if closed
    var content;
    
    // function to restore normal mode
    function restoreNormalMode() {
        locationErrorDragMode = false;
        update();
    }
    
    // clear all other markers off the map
    removeMarkers();
    
    // hide info window
    hideInfo();
    
    // close the form window
    $("#dialog-form").dialog("close");
    
    // notify the user that they need to drag the icon
    notifyUser("Report Error", "Drag the icon to report its true location. Move and zoom the map as needed!",
        0, { my: "top-235", at: "center", of: "#map-canvas" });
    
    var notification = $( "#dialog-notification" );
    
    // make icon draggable
    selectedMarker.setDraggable(true);
    
    // hide info window and label when marker is dragged
    google.maps.event.addListener(selectedMarker, 'drag', function () {
        
        // hide the label and info window
        hideInfo();
        selectedMarker.set("labelVisible", false); 
    });
    
    // show info window and label again when drag is over
    google.maps.event.addListener(selectedMarker, 'dragend', function () {
        
        // prepare content window for user to confirm placement
        // button for correct spot
        var content = '<div class="text-center"><div class="btn-group" role="group"><button id="reportDragError" type="button" class="btn btn-primary btn-xs")">Looks good! Report it!</button>';
    
        // button to click if not in right spot, closes info window
        content += '<button id="cancelDragError" type="button" class="btn btn-danger btn-xs" onclick="hideInfo()">Not here!</button></div></div>'
        
        // show info window and label
        showInfo(selectedMarker, content)
        selectedMarker.set("labelVisible", true); 
        
        // if user closes out of info window; return map to normal operation
        google.maps.event.addListener(info, 'closeclick', function() {
            restoreNormalMode();
        });
        
        // function for submission
        $("#reportDragError").click(function () {

            // build parameters
            var parameters = {
                formType: "dragToReport",
                id: selectedMarkerInfo["id"],
                latitude: selectedMarker.getPosition().lat(),
                longitude: selectedMarker.getPosition().lng(),
            };
            
            // AJAX request to report error
            $.get("reportError.php", parameters);
        
            // close notification window
            notification.dialog("close");
            
            // hide info window
            hideInfo();
            
            // restore to normal mode
            restoreNormalMode();
            
            // thank the user for the input
            notifyUser("Error Report Submitted", "Thanks for the feedback!", 2000);
            
        })

            
    });
    
}
    


/**
 * Notify the user with a dialog using the provided title and message.
 * If delay is not desired, provde 0 as argument.  Position is optional and defaults to center of window.
 */
 function notifyUser(title, message, delay, position)
 {
     
     // set position if not provided
     if (typeof position === 'undefined') { 
         position = { my: "center", at: "center", of: window };
     }
     
    // check if dialog notification exists (because this function has already been called)
    if ( $( "#dialog-notification" ).length ) {
        
        // delete previous message
        $( "#dialog-notification" ).remove();
    }
    
    // body of message
    var htmlBody = $( "body" );
     
    // clear any text from previous uses
    //htmlBody.empty();
     
    // append message div to body
    htmlBody.append('<div id="dialog-notification" title="'+ title + '"><p>' + message + '</p></div>');

    // display message
    var notification = $( "#dialog-notification" );
    notification.dialog({
       position: position,
       buttons: {
           Ok: function () {
               notification.dialog( "close");
           }
       },
    
        // when opened
        open: function(){
        
            // close after delay if provided
            if (delay !== 0) {
                setTimeout(function(){
                   notification.dialog( "close" ); 
                }, delay);
            }
        
        },
        
        // when closed
        close: function(){

        }
        
    });
    
 }


/**
 * Open a modal window with information about the website.
 */
function displayAbout()
{
    var aboutUs = $( "#dialog-message" );
    aboutUs.dialog({
        modal: true,
        resizable: false,
        buttons: {
            Ok: function () {
                aboutUs.dialog( "close");
            }
        },
        
        // when opened
        open: function(){

        },
        
        // when closed
        close: function(){

        }
        
    });
    
}


/**
 * Check for mobile browsers with REGEX from 
 */
function mobileCheck()
{
    mobileStatus = false;
    
    // check for mobile with REGEX http://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))mobileStatus=true})(navigator.userAgent||navigator.vendor||window.opera); 
    
    return mobileStatus;
}

/**
 * Format query, correcting for acronyms, adjusting for database standards, etc.
 */
function formatQuery(query)
{
    // associative array with abbreviations
    var aliases = {
        
        // place aliases
        "ANAD" : "Anniston Army Depot",
        "CAIN" : "Camp Atterbury",
        "CBFL" : "Camp Blanding",
        "CGMI" : "Camp Grayling",
        "CGOK" : "Camp Gruber",
        "CRMN" : "Camp Ripley",
        "CSMS" : "Camp Shelby",
        "FBGA" : "Fort Benning",
        "FBNC" : "Fort Bragg",
        "FCAR" : "Fort Chaffee",
        "FCCO" : "Fort Carson",
        "FCKY" : "Fort Campbell",
        "FCKY" : "Fort Campbell",
        "FDNY" : "Fort Drum",
        "FGA" : "Fort Greely",
        "FGGA" : "Fort Gordon",
        "FHL" : "Fort Hunter Liggett",
        "FHLCA" : "Fort Hunter Liggett",
        "FHTX" : "Fort Hood",
        "FLKS" : "Fort Leavenworth",
        "FMWI" : "Fort McCoy",
        "FPLA" : "Fort Polk",
        "FPVA" : "Fort Pickett",
        "FRKS" : "Fort Riley",
        "FSGA" : "Fort Stewart",
        "FTLVN" : "Fort Leavenworth",
        "FWA" : "Fort Wainwright",
        "GFID" : "Gowen Field",
        "HAAF" : "Hunter Army Airfield",
        "JBLM" : "Joint Base Lewis McChord",
        "JBMDL" : "Joint Base McGuire Dix Lakehurst",
        "PBA" : "Pine Bluff Arsenal",
        "POM" : "Presidio of Monterey",
        "RAB" : "Ramstein",
        
        // acronym aliases, really onerous acronyms that are rarely fully typed type are changed full-text to acronym
        // generally, most are changed from acronym to full-text to allow SQL natural language search to work best
        "ACS": "Army Community Service",
        "AER": "Army Emergency Relief",
        "EFMP": "Exceptional Family Member Program",
        "ACAP": "Army Career Alumni Program ACAP",
        "MWR": "Morale, Welfare, and Recreation",
        "CDC": "Child Development Center",
        "CDS": "Child Development Services",
        "SFAPM": "Soldier and Family Assistance Program",
        "SFAP": "Soldier and Family Assistance Program",
        "Army and Air Force Exchange": "AAFES",
        "Army and Air Force Exchange Service": "AAFES",
        "Army and Air Force Exchange Services": "AAFES",
        "FRP": "Financial Readiness Program",
        "FAP": "Family Advocacy Program",
        "NAF": "Non Appropriated Funds",
        "NACCRRA": "National Association of Child Care Resource and Referral",
        "NACRRA": "National Association of Child Care Resource and Referral",
        "NACRA": "National Association of Child Care Resource and Referral",
        "NACCRA": "National Association of Child Care Resource and Referral",
        "MEB": "Medical Evaluation Board",
        "JAG": "Judge Advocate",
        "FT": "Fort",
        
        // general aliases
        "grocery": "commissary",
        "groceries": "commissary",
        "bank": "financial institution bank",
        "child care": "child development care",
        "gas station": "automotive service gas",
        "service station": "automotive service gas",
        "gym": "Gymnasiums/Fitness gym fitness",
        "fitness center": "Gymnasiums/Fitness gym fitness",
        "nonappropriated": "Non Appropriated",
        "food": "commissary shoppette restaurants fast food",
        "ed center": "education center",
        "day care": "day child care"
 
    };
    
    // replace any acronyms in query with full text of word
    for (var alias in aliases)
    {
        
        // create regex to make this case-insensitive; add word boundary character
        var regex = new RegExp(alias + "\\b", "gi");
        
        // find and replace
        query = query.replace(regex, aliases[alias]);
        
    }

    return query;
} 

/**
 *  Brings up the place called for in the url query
 *  Needed so that search engines can index site from provided sitemap of urls with queries
 */
function updateFromQuery(){
    
    // get query from URL
    var query = window.location.search;
    
    // get ride of ? in query
    query = query.replace("?", '');
    
    // if query string does not exist or is not alphanumeric, stop
    if(!query || !isNumeric(query)) {
        console.log("Invalid Query");
        return;
    }
    
    var parameters = {
        id: query,
    };
    
    $.getJSON("updateFromQuery.php", parameters)
    .done(function(data, textStatus, jqXHR) {

        urlQuerySuccessful = true;

        // update page elements to aid in search engine crawling
        $("title").text("Military Finder - " + data[0]["installation"] + " " + data[0]["title"] + " - Address and Phone Number");
        $("#metaDescription").attr("content", "Military Finder has phone numbers and addresses for the " +
            data[0]["title"] + " and other locations around " + data[0]["installation"] + ".");

        // zoom and re-center map
        typeaheadOrUrlSelect(data[0])
        
    })
    .fail(function(jqXHR, textStatus, errorThrown) {

        // log error to browser's console
        console.log(errorThrown.toString());
    });
    
    function isNumeric(str) {
        return /^[0-9]+$/.test(str);
    }
}

function typeaheadOrUrlSelect(placeInfo) {
        
        // update status
        typeaheadSelected = true;
        
        // ensure coordinates are numbers
        var latitude = (_.isNumber(placeInfo.latitude)) ? placeInfo.latitude : parseFloat(placeInfo.latitude);
        var longitude = (_.isNumber(placeInfo.longitude)) ? placeInfo.longitude : parseFloat(placeInfo.longitude);

        // set map's center and zoom
        map.setCenter({lat: latitude, lng: longitude});
        map.setZoom(15);

        // set selected marker global variable to the one selected
        selectedMarkerInfo = placeInfo;
        
        // add a marker for the selected place
        selectedMarker = addMarker(selectedMarkerInfo);
        
        // get content for info window
        var content = getContent(selectedMarkerInfo);
        
        // open window with content
        showInfo(selectedMarker, content);
        
        // show label on marker
        selectedMarker.set("labelVisible", true);
        
        // update UI
        update();
}
