<?php

    require(__DIR__ . "/../includes/config.php");

    // numerically indexed array of places
    $places = [];
    
    // query variable for readability
    $query = $_GET["geo"];
    
    // words to delete from query
    $extraneousWords = ["the", "a", "some"];
    
    // look for and delete common phrases from query to aid recognition
    foreach ($extraneousWords as $extraneousWord)
    {
        $query = str_ireplace("$extraneousWord ", "", $query);
    }
    
    
    // get rid of leading and trailing white space from query
    $query = trim($query);
    
    // list of common locations; must ensure terms match those corrected in scripts.js under formatQuery
    $commonLocations = ["commissary", "financial institution bank", "Army Career Alumni Program ACAP", "Child Development Center", "Child Development Services",
        "Morale, Welfare, and Recreation", "Exceptional Family Member Program", "Army Community Service", "child development care", "automotive service gas", "aafes",
        "Gymnasiums/Fitness gym fitness", "Army Emergency Relief", "Financial Readiness Program", "family advocacy program",
        "shoppette", "child care",
    ];
        
    
    // look for exact match of common locations (without subsequent words that would indicate a location in query)
    foreach ($commonLocations as $location)
    {
        // if matched, sort by geography
        if (strcasecmp($query, $location) == 0)
        {
            
            // filter out results without lat/long coordinates with <>0
            // used ideas from http://stackoverflow.com/questions/15583520/ordering-sql-results-based-on-distance-formula
            $places = CS50::query("

                SELECT * FROM 
                (
                    SELECT *, MATCH (installation, title, directory, address_line1, address_line2, city, state) 
                    	AGAINST (? IN NATURAL LANGUAGE MODE) AS score, 
                    	(3959 * acos( cos( radians(?) ) * cos( radians( latitude ) ) 
                       	* cos( radians( longitude ) - radians(?) ) + sin( radians(?) ) * sin(radians(latitude)) )) AS distance
                    FROM military_installations 
                    WHERE MATCH (installation, title, directory, address_line1, address_line2, city, state) 
                    AGAINST (? IN NATURAL LANGUAGE MODE)
                    ORDER BY distance
                    LIMIT 20
                ) 
                AS T1
                ORDER BY CASE 
                	WHEN distance < 20 THEN distance
                	ELSE score * -10000000
                END DESC
                    
                ", $query, $_GET["map_lat"], $_GET["map_long"], $_GET["map_lat"], $query);
                
            returnJSON($places);
        }
        
    }
    
    // filter out results without lat/long coordinates with <>0
    // if no match, do normal (non-geo relevent search), return SQL results, limiting to 20 for performance        
    $places = CS50::query("SELECT * FROM military_installations WHERE MATCH (installation, title, directory, address_line1, 
    address_line2, city, state) AGAINST (? IN NATURAL LANGUAGE MODE) AND latitude<>0 AND longitude<>0 LIMIT 20", $query);  
    
    returnJSON($places);

    function returnJSON($content)
    {
        
        // output places as JSON (pretty-printed for debugging convenience)
        header("Content-type: application/json");
        print(json_encode($content, JSON_PRETTY_PRINT));
        exit;
    }

?>