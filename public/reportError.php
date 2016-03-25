<?php

    require(__DIR__ . "/../includes/config.php");

    // if locationError
    if ($_GET["formType"] == "locationError")
    {
        
        // checks (should match client side checks in scripts)
        $checks = [
            "address_line1" => '/^\s*\S+(?:\s+\S+){2}/',
            "city" => '/^[a-zA-Z]{3,50}$/',
            "state" => '/^[A-Z]{2}$/',
            "zip_code" => '/^[0-9]{5}$/',
        ];
        
        // check input
        $valid = checkInput($checks);
        
        if ($valid == true)
        {
            
            // insert error report into database   
            CS50::query("INSERT INTO place_errors (id, address_line1, city, state, zip_code) VALUES (?, ?, ?, ?, ?)", 
                $_GET["id"], $_GET["address_line1"], $_GET["city"], $_GET["state"], $_GET["zip_code"]); 
        }
    }
    
    // if phoneError
    if ($_GET["formType"] == "phoneError")
    {
        
        // checks (should match client side checks in scripts)
        $checks = [
            "phone" => '/^\s*(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?\s*$/',
        ];
        
        // check input
        $valid = checkInput($checks);
        
        if ($valid == true)
        {
            
            // insert error report into database   
            CS50::query("INSERT INTO place_errors (id, commercial_phone1) VALUES (?, ?)", 
                $_GET["id"], $_GET["phone"]);
        }
    }
    
    // if titleError
    if ($_GET["formType"] == "titleError")
    {
        
        // checks (should match client side checks in scripts)
        $checks = [
            "title" => '/^[a-z\d\-_\s]+$/i',
        ];
        
        // check input
        $valid = checkInput($checks);
        
        if ($valid == true)
        {
        
            // insert error report into database   
            CS50::query("INSERT INTO place_errors (id, title) VALUES (?, ?)", 
                $_GET["id"], $_GET["title"]);
        }
    }
    
    // if submitted by dragging
    if ($_GET["formType"] == "dragToReport")
    {
        
        // TODO catching errors at database for now; ideally would check here
        
        // insert into database
        CS50::query("INSERT INTO place_errors (id, latitude, longitude) VALUES (?, ?, ?)", 
        $_GET["id"], $_GET["latitude"], $_GET["longitude"]);    
    }

    function checkInput($checks)
    {
        $valid = true;
        
        // loop through checks
        foreach ($checks as $item => $regex)
        {
            
            // if check failed; terminate loop
            if (!preg_match($regex, $_GET[$item]))
            {
                $valid = false;
                break;
            }
        }
        
        return $valid;
    }

?>