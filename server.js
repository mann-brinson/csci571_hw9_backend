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

// GLOBAL FUNCTIONS
function buildReq(url) {
    //Construct a request object for each url
    const req = axios.get(url);
    return req
}

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

        if (entity_type == "movie") {
            result["name"] = obj.title
            result["year"] = obj.release_date.split('-')[0]
        } else {
            result["name"] = obj.name
            result["year"] = obj.first_air_date.split('-')[0]
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

    console.log({"head_url": url_head})
    console.log({"body_urls": url_list})

    //Send requests asynchronously, then process all responses
    axios.all(requests).then(axios.spread((...responses) => {

        //For each response, for each movie object, parse out the desired features
        // based on list_type (ex: "now_playing", "trending", ...)
        var output = {}
        output["body"] = {}

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
                output["body"][list_type] = movie_list_extracted
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

//// DETAILS PAGE
app.get('/apis/watch/:entity/:tmdb_id', function (req, res) {

    //Get query parameters
    entity = req.params.entity
    tmdb_id = req.params.tmdb_id

    //Build requests
    url_root = "https://api.themoviedb.org/3/"
    url_detail = `${url_root}${entity}/${tmdb_id}?api_key=${api_key}`
    url_video = `${url_root}${entity}/${tmdb_id}/videos?api_key=${api_key}`
    url_credits = `${url_root}${entity}/${tmdb_id}/credits?api_key=${api_key}`
    url_reviews = `${url_root}${entity}/${tmdb_id}/reviews?api_key=${api_key}`
    url_recommended = `${url_root}${entity}/${tmdb_id}/recommendations?api_key=${api_key}`

    

    urls = [["detail", url_detail], ["video", url_video],
            ["credits", url_credits], ["reviews", url_reviews],
            ["recommended", url_recommended]]

    console.log({"getting this url: ": urls})

    requests = []
    urls.forEach((url) => {
        req = buildReq(url[1])
        requests.push(req)
    })
    
    //// PARSING FUNCTIONS
    // DETAIL
    function parseDetail(obj, entity) {
        var result = {}
        if (entity == "movie") {
            result["name"] = obj.title
            result["year"] = obj.release_date.split('-')[0]
            result["runtime"] = obj.runtime
        } 
        else {
            result["name"] = obj.name
            result["year"] = obj.first_air_date.split('-')[0]
            result["runtime"] = obj.episode_run_time[0]
        }
        if (obj.poster_path == null) {
            result["poster_path"] = "https://cinemaone.net/images/movie_placeholder.png"
        }
        else {
            result["poster_path"] = "https://image.tmdb.org/t/p/w500" + obj.poster_path
        }

        result["tmdb_id"] = obj.id
        result["entity_type"] = entity
        let genres_list = obj.genres.map(item => item.name)
        result["genres"] = genres_list.join(', ')
        result["spoken_languages"] = obj.spoken_languages.map(item => item.english_name)
        result["overview"] = obj.overview
        result["vote_average"] = (Math.round((obj.vote_average / 2) * 10) / 10).toString()
        return result
    }

    // VIDEO
    function parseVideo(obj, entity) {
        var trailers = []
        var teasers = []
        obj.results.forEach((video) => {
            if (video.site == "YouTube") {
                if (video.type == "Trailer") {trailers.push(video)}
                else if (video.type == "Teaser") {teasers.push(video)}
            }
        })

        var result = {}
        if (trailers.length > 0) {
            result["site"] = trailers[0].site
            result["type"] = trailers[0].type
            result["name"] = trailers[0].name
            result["key"] = trailers[0].key
        }
        else if (teasers.length > 0) {
            result["site"] = trailers[0].site
            result["type"] = trailers[0].type
            result["name"] = trailers[0].name
            result["key"] = trailers[0].key
        }
        return result
    }
    
    // CREDITS
    function parseCredits(obj) {
        var result = []
        obj.cast.forEach((person, i) => {
            if (i < 10) { //Grab only the top 10 credits
                var record = {}
                record["id"] = person.id
                record["name"] = person.name
                record["character"] = person.character
                if (person.profile_path == null) {
                    record["profile_path"] = "https://bytes.usc.edu/cs571/s21_JSwasm00/hw/HW6/imgs/person-placeholder.png"
                } else {
                    record["profile_path"] = `https://image.tmdb.org/t/p/w500/${person.profile_path}`
                }
                result.push(record)
            }
        })
        return result
    }

    // REVIEWS
    function parseReviews(obj) {
        var result = []
        obj.results.forEach((review, i) => {
            if (i < 3) { //Grab only the top 3 reviews
                var record = {}
                record["id"] = review.id
                record["author"] = review.author
                record["content"] = review.content

                var date_raw = new Date(review.created_at)
                let formatted_date = `${date_raw.toLocaleString('default', { month: 'short' })} ${date_raw.getDate()}, ${date_raw.getFullYear()}`
                record["created_at"] = formatted_date

                console.log(review.created_at)
                record["url"] = review.url
    
                if (review.author_details.rating == null) {
                    record["rating"] = 0
                } else {
                    record["rating"] = Math.round((review.author_details.rating / 2) * 10) / 10
                }
    
                result.push(record)
            }
        })
        return result
    }

    // RECOMMENDED
    function parseRecommended(obj, entity) {
        //Extract only necessary features from movie_obj
        var result = []
        if (obj.results.length == 0) {
            return result
        } else {
            obj.results.forEach((item, i) => {
                if (i < 20) { //Grab only the top 20
                    var record = {}
                    record["id"] = item.id
        
                    if (entity == "movie") {
                        record["name"] = item.title
                        record["entity_type"] = "movie"
                        if (item.release_date) {
                            record["year"] = item.release_date.split('-')[0]
                        } else {
                            record["year"] = ""
                        }
                        
                    } else {
                        record["name"] = item.name
                        record["entity_type"] = "tv"

                        if (item.first_air_date) {
                            record["year"] = item.first_air_date.split('-')[0]
                        } else {
                            record["year"] = ""
                        }
                        
                    }
    
                    if (item.poster_path == null) {
                        record["poster_path"] = "https://cinemaone.net/images/movie_placeholder.png"
                    } else {
                        record["poster_path"] = "https://image.tmdb.org/t/p/w500" + item.poster_path
                    }
                    result.push(record)
                }
            })
        }
        return result
    }

    axios.all(requests).then(axios.spread((...responses) => {
        //Parse desired features from each response,
        // based on the response type (ex: "detail", "credits", "reviews")
        var output = {}

        //// DETAIL
        obj = responses[0].data
        detail = parseDetail(obj, entity)
        output["detail"] = detail

        //// VIDEO
        obj = responses[1].data
        video = parseVideo(obj, entity)
        output["video"] = video

        //// CREDITS
        obj = responses[2].data
        credits = parseCredits(obj)
        output["credits"] = credits

        //// REVIEWS
        obj = responses[3].data
        reviews = parseReviews(obj)
        output["reviews"] = reviews

        //// RECOMMENDED
        obj = responses[4].data
        recommended = parseRecommended(obj, entity)
        output["recommended"] = recommended

        // res.send("made it")
        res.send(output)

      })).catch(errors => {
        // react on errors.
      })

})

//// SEARCH PAGE
app.get('/apis/search/:terms', function (req, res) {
    //Get query params
    terms = req.params.terms

    //Build request
    url_search = `https://api.themoviedb.org/3/search/multi?api_key=${api_key}&language=en-US&query=${terms}`
    requests = []
    req = buildReq(url_search)
    requests.push(req)

    //// PARSING FUNCTIONS
    function parseSearchResults(obj) {
        var result = []

        if (obj.total_results == 0) {
            return "no results found"
        } else (
            obj.results.forEach((s_result, i) => {

                if (i < 7) { //Show only the top 7 records
                    record = {}

                    record["id"] = s_result.id
                    record["media_type"] = s_result.media_type
                    record["rating"] = Math.round((s_result.vote_average / 2) * 10) / 10

                    if (s_result.media_type == "tv") {
                        record["name"] = s_result.name
                        record["year"] = s_result.first_air_date.split('-')[0]
                    } else if (s_result.media_type == "movie") {
                        record["name"] = s_result.title
                        record["year"] = s_result.release_date.split('-')[0]
                    }

                    if (s_result.backdrop_path == null) {
                        record["backdrop_path"] = "https://bytes.usc.edu/cs571/s21_JSwasm00/hw/HW6/imgs/movie-placeholder.jpg"
                    } else {
                        record["backdrop_path"] = "https://image.tmdb.org/t/p/original" + s_result.backdrop_path
                    }
                    result.push(record)
                }
            })
        )
        return result
    }

    axios.all(requests).then(axios.spread((...responses) => {
        //Parse desired features from each response
        var output = {}

        obj = responses[0].data

        // SEARCH RESULTS
        result = parseSearchResults(obj)
        res.send(result)

      })).catch(errors => {
        // react on errors.
      })
    
})

// Define port and listen on the port
const PORT = process.env.PORT || 8080
var server = app.listen(PORT, function() {
    console.log("Backend Application listening at http://localhost:8080")
})