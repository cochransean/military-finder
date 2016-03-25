<?php
    
    require(__DIR__ . "/../includes/config.php");
    
    // get query
    $query = $_GET["id"];
    
    // get item from server
    $place = CS50::query("SELECT * FROM military_installations WHERE  id=?", $query);
    
    // if database returns empty array
    if (empty($place))
    {
        http_response_code(404);
        exit;
    }
    
    // output places as JSON (pretty-printed for debugging convenience)
    header("Content-type: application/json");
    print(json_encode($place, JSON_PRETTY_PRINT));
    
?>