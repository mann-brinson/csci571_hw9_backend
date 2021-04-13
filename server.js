//Import statements
var express = require('express')
var cors = require('cors')
const axios = require('axios')

//Create app
var app = express()
app.use(cors())
app.set('json spaces', 2)

//GLOBAL PARAMETERS
var api_key = "2e510746ca28d7041056c7e57108de4c"

//////////// ROUTES ////////////
//// HOME
app.get('/apis/home/:entity', function(req, res) {

    //// GOAL: For each list_type, construct url, hit the endpoint and get X items
    const movie_head_el_pair = ["movie", "now_playing"]
    const tv_head_el_pair = ['tv', 'trending']
    const list_types = ['top_rated', 'popular']

    //Get query parameters and set curr_entity_listtypes
    var entity = req.params.entity

    // Get head paramaters
    if (entity == "movie") {
        head_el_pair = movie_head_el_pair
    } else if (entity = "tv") {
        head_el_pair = tv_head_el_pair
    }

    // Get body parameters
    entity_listtypes = buildELPairs(entity, list_types)

    //// FUNCTIONS
    function buildELPairs(entity, list_types) {
        //Construct entity_listtype pairs, used in url construction later
        var entity_listtypes = []
        list_types.forEach((listtype) => {
            entity_listtypes.push([entity, listtype])
        })
        return entity_listtypes
    }

    function buildURL(api_key, entity_type, list_type) {
        //For each list_type, build a url
        if (list_type != "trending") {
            var url_full = `https://api.themoviedb.org/3/${entity_type}/${list_type}?api_key=${api_key}`
        } else {
            var url_full = `https://api.themoviedb.org/3/${list_type}/${entity_type}/day?api_key=${api_key}`
        }
        return url_full
    }

    function buildReq(url) {
        //Construct a request object for each url
        const req = axios.get(url);
        return req
    }

    function extract_details(obj, entity_type) {
        //Extract only necessary features from movie_obj
        var result = {}
        result["id"] = obj.id
        result["entity_type"] = entity_type
        // result["test"] = "test"

        if (entity_type == "movie") {
            result["name"] = obj.title
        } else {
            result["name"] = obj.name
        }

        //Extract backdrop_path for the "now_playing" movies
        result["poster_path"] = "https://image.tmdb.org/t/p/w500" + obj.poster_path
        return result
    }

    //// DRIVER
    // Body lists
    url_list = entity_listtypes.map(el_pair => {
        return buildURL(api_key, el_pair[0], el_pair[1])
    })
    requests = url_list.map(url => {
        return buildReq(url)
    })

    // Head list
    url_head = buildURL(api_key, head_el_pair[0], head_el_pair[1])
    request_head = buildReq(url_head)
    requests.push(request_head) //IMPORTANT: The last request is for head

    // console.log({"head_url": url_head})
    // console.log({"body_urls": url_list})

    //Send requests asynchronously, then process all responses
    axios.all(requests).then(axios.spread((...responses) => {

        //For each response, for each movie object, parse out the desired features
        // based on list_type (ex: "now_playing", "trending", ...)
        var output = {}

        //// BODY-LISTS
        responses.forEach((response, i) => {
            if (i < responses.length-1) { //Only look at body responses
                entity_type = entity_listtypes[i][0]
                list_type = entity_listtypes[i][1]
                const movie_list_extracted = []
    
                //INNER LOOP
                response.data.results.forEach((obj, j) => {
                    if (j < 20) { //Grab the top 20 movies/shows
                        result = extract_details(obj, entity_type, list_type)
                        movie_list_extracted.push(result)
                    }
                })
                
                //Associate the list_type with the extracted movies/tv_shows
                var obj_list = new Object()
                obj_list[list_type] = movie_list_extracted
                if (!(entity_type in output)) {
                    // output[entity_type] = [obj_list]
                    output['body'] = [obj_list]
                } else {
                    // output[entity_type].push(obj_list)
                    output['body'].push(obj_list)
                }
            }
        //// HEAD-LIST
        head_resp = responses[responses.length-1]

        //Extract movie features
        const movie_list_extracted = []
        response.data.results.forEach((obj, i) => {
            if (i < 5) { //Grab the top 5 movies/shows
                entity_type = head_el_pair[0]
                list_type = head_el_pair[1]
                result = extract_details(obj, entity_type, list_type)
                movie_list_extracted.push(result)
            }
        })

        //Associate list_type with extracted movies
        var obj_list = new Object()
        obj_list[list_type] = movie_list_extracted
        output["head"] = obj_list

        })
        res.send(output)

    })).catch(errors => {
        // react on errors.
    })

    
})

// Define port and listen on the port
const PORT = process.env.PORT || 8080
var server = app.listen(PORT, function() {
    console.log("Backend Application listening at http://localhost:8080")
})