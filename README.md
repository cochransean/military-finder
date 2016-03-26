# MilitaryFinder

# Synopsis
MilitaryFinder is a website built on Google's Javscript Maps API that consolidates important information for military families, such as the location of on-base hospitals, gyms, etc., into one, easy-to-search spot.

# Motivation
The military's own solutions for finding on-base services tend to be difficult to search, sometimes are buried on old websites, and do not allow users to provide feedback if phone numbers or addresses are inaccurate--leading to stale data.

# Components
/bin: Contains the script used to geocode addresses via Google's Geocode API.  I started with addresses scraped from http://www.militaryinstallations.dod.mil/, cleaned them using OpenRefine, and then geocoded them with this script.

/public: Contains all JS, PHP, and HTML files for the website itself.

/vendor: Contains PHP functions and dependencies, used under license.

# License
MIT License

Copyright (c) 2016 Sean Ryan Cochran

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
