<?php

    /**
     * config.php
     *
     * Sean Cochran
     * CS50 Final Project
     * MilitaryOneStop
     * 
     * Based on Distribution Code for CS50 Problem Set 8.
     *
     * Configures pages.
     */

    // display errors, warnings, and notices
    ini_set("display_errors", true);
    error_reporting(E_ALL);

    // CS50 Library
    require("../vendor/library50-php-5/CS50/CS50.php");
    CS50::init(__DIR__ . "/../config.json");

?>