/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var geekinViewControllers = angular.module('geekinViewControllers', []);

/*
 * ==== Factories =====
 */

/*
 * Data that is centrally shared throughout the application. Stores user specific
 * information such as username.  
 */
geekinViewControllers.factory('Data', function($rootScope){
    var sharedService = {};
    //sharedService.username = 'liltimtim' + Math.random().toString().replace('.','') ; //this is temporary will be setup on login
    sharedService.username = '';
    sharedService.userHasLoggedIn = false;
    sharedService.message = '';
    sharedService.songId = '';
    sharedService.tracks = [];
    sharedService.bytesLoaded = 0;
    sharedService.bytesTotal = 0;
    sharedService.showPage = false;
    
    //===== Ingest Data =====
    sharedService.prepForDataEmit = function(loaded, total){
        this.bytesLoaded = loaded;
        this.bytesTotal = total;
        this.broadcastSongData();
    };
    sharedService.prepForBroadcast = function(msg){
        sharedService.message = msg;
        sharedService.broadcastItem();
    };
    sharedService.userLoggedIn = function(){
        this.userHasLoggedIn = true;
    };
    
    //==== notify other controllers that are listening for events =====
    sharedService.broadcastItem = function(){
        $rootScope.$broadcast('handleBroadcast');
    };
    sharedService.broadcastSongData = function(){
        $rootScope.$broadcast('bytesLoaded');
    };
    sharedService.broadcastUserHasLoggedIn = function(){
        $rootScope.$broadcast('userHasLoggedIn');
    }
    return sharedService;
});

/*
 * stores the search results in a commonly used singleton class for multiple controllers
 * to access.
 */
geekinViewControllers.factory('searchResultFactory', function($rootScope){
    var searchResultsFactoryService = {};
    searchResultsFactoryService.tracks = {};

    return searchResultsFactoryService;
});

/*
 * Shared watchers of firebase.  
 * Watches for pause/play events, song changes, and number of listeners
 * currently attached to your broadcast! 
 */
geekinViewControllers.factory('firebaseWatch', function($rootScope, $firebase, Data){

    var firebaseWatchService = {};
    console.log("attaching to firebase playlist for user", Data.username);

    firebaseWatchService.playlists = [];

    firebaseWatchService.pausePlayEvent = false;
    firebaseWatchService.listenerCountHasChangedTo = 0;


    //watch firebase for remote pause play event (broadcaster pauses song or plays song
    firebaseWatchService.remotePlayEventOccurred = function(){
        $rootScope.$broadcast('remotePausePlayEvent', firebaseWatchService.pausePlayEvent);
    };

    //watch firebase for changes in listener count
    firebaseWatchService.listenerCountChanged = function(){
        $rootScope.$broadcast('listenerCountHasChanged', firebaseWatchService.listenerCountHasChangedTo);
    };
    return firebaseWatchService;
});
// === End Factories ======

// === Directives =====
//handles the pause/play button switching glyphs
geekinViewControllers.directive('playbarWidget', function(playbarData, $timeout){
    var linkFunction = function($scope, $element, $attributes){
        var glyphIcon = $element.children().children();
        $(glyphIcon).on("click", function(e){
            console.log("pauseplay button clicked");
            console.log(playbarData.currentSong);
            console.log("playbar widget song paused");
            console.log(playbarData.currentSong.paused);
            $timeout(function(){
                console.log("timeout");
            }, 1000);
            if(playbarData.currentSong.paused === true){
                console.log("play button", playbarData.isSongPaused);
                $(this).attr("class", "glyphicon glyphicon-pause");
            }
            if(playbarData.currentSong.paused === false){
                console.log("pause button", playbarData.isSongPaused);
                $(this).attr("class", "glyphicon glyphicon-play");
            }
        });
    };
    return {
        restrict: 'E',
        link: linkFunction
    };
});

//handles the data loading on the progress bar and playback of sound
//Data.bytesLoaded serves two purposes one for displaying data loaded
//second for showing the position in the song
geekinViewControllers.directive('progressBarWidget', function(Data){
    var linkFunction = function($scope, $element, $attr){
        $scope.$on('bytesLoaded', function(){
            $element.children().children($("#progressBar").css("width", Data.bytesLoaded+"%"));
        }, true);
    };
    return {
        restrict: 'E',
        link: linkFunction
    };
});
// === End Directives =====

/*
 * Main Controller which handles all other controllers
 * Handles users navigation and interaction with app
 */
geekinViewControllers.controller('mainCtrl', function($route, $window, $routeParams, $location, $scope, Data){
    $scope.Data = Data;
    $scope.showPage = Data.showPage;
    if(Data.username === ''){
        $location.url('/login');
    }
    $scope.$on('userHasLoggedIn', function(){
        $scope.showPage = true;
    });
});

geekinViewControllers.controller('loginViewCtrl', function(Data, $timeout, $location, $scope, $rootScope){
    $scope.Data = Data;
    console.log($scope.Data);
    $scope.username = '';
    $scope.login = function(){
        Data.username = $scope.username;
        Data.showPage = true;
        $timeout(function(){
            $rootScope.$broadcast('userHasLoggedIn');
        });
        $location.url('/');

    };
});

/*
 * handles the searching view. When user clicks on a song it will begin playing
 * and sets their online status to true allowing other users to listen into their
 * broadcast. 
 * 
 * If a user searches for a song it can be assumed they want to broadcast.
 * Before they play the song they will subscribe to their own broadcast channel
 * on firebase so that they are synchronized with the fb server time instead
 * of their own client time.  This ensure synchronization across all devices. 
 */
geekinViewControllers.controller('searchViewCtrl', function($scope, Data, playbarData){
    $scope.Data = Data;
    SC.initialize({
        client_id:'0f0e321b9652115f3a8ea04f5030f9c0'
    });
    $scope.search = function(params){
        $scope.Data.tracks = [];

        //bpm from 10 guarantees tracks are at least 10 beats per minute and prevents other media
        //types from being returned.
        SC.get('/tracks', {q: params}, function(tracks){
            //guarantees search results are updated while waiting on 
            //SC delivery of data. If apply isn't here it wont always update 
            //give 500 error
            $scope.$apply(function(){
                $scope.Data.tracks = tracks;
            });
        });
    };
    $scope.prepForPlayback = function(trackInfo){
        //trackInfo contains ALL the SC return data 
        console.log(trackInfo);
        //Setup the shared playbar data
        $scope.playbarData = playbarData;
        //broadcast to the playbar the user wants to play a song
        $scope.playbarData.prepForBroadcast(trackInfo, $scope.Data.username);
        $scope.Data.prepForBroadcast(trackInfo);
    };
});

/*
 * handles playlist creation and saving to firebase
 */
geekinViewControllers.controller('playlistViewCtrl', function($scope, firebaseWatch, $location){
    //create three way binding to playlists and update them once they are change


    /*
     * playlist object will have the following:
     * key/value pairs
     * playlist_name: name
     * tracks: [] <-- contains just the track ID provided by SC minimize the amount of data required
     */
    $scope.newPlaylist = function(){
        $location.url('/playlists/edit');
    }
    
});

/*
 * Handles the editing and order arangement of playlist tracks.  Allows users to rename their playlist.
 * Playlists is bound to firebase, any change will update firebase as well
 */

geekinViewControllers.controller('playlistEditViewCtrl', function($scope, $firebase, firebaseWatch, Data){
    //Todo: Add methods to edit playlist and you need to add a route ID (playlist name) to edit.
    //playlists will have a unique "name" so users wont have key value pair collisions.
    //Todo: validate and check for key collisions for playlist names
    $scope.totalSongs = 0;
    $scope.searchParams = '';
    $scope.firebaseWatch = firebaseWatch;
    $scope.currentPlaylist = {};
    $scope.currentPlaylist.title = 'test';
    $scope.currentPlaylist.tracks = [];

    var fbRef = new Firebase("https://geekinapp.firebaseio.com/station/"+Data.username+"/playlists");
    var fbPlaylists = $firebase(fbRef).$asObject();
    fbPlaylists.$bindTo($scope, 'playlists');

    //get SC authorization to search
    SC.initialize({
        client_id:'0f0e321b9652115f3a8ea04f5030f9c0'
    });
    $scope.addToPlaylist = function(track){
        $scope.currentPlaylist.tracks.push(track.title);
        $scope.playlists[$scope.currentPlaylist.title] = $scope.currentPlaylist;
        console.log($scope.currentPlaylist.tracks);
        //$scope.playlists[$scope.currentPlaylist.title] = $scope.currentPlaylist.tracks;
        $scope.totalSongs = $scope.playlists[$scope.currentPlaylist.title].tracks.length;

        //console.log("this is the firebaseWatch", firebaseWatch.playlists);
    };

    //search SC for input params
    $scope.search = function(searchParams) {
        $scope.tracks = {};
        SC.get('/tracks', {q: searchParams, bpm: {from: 10}}, function (tracks) {
            //guarantees search results are updated while waiting on
            //SC delivery of data. If apply isn't here it wont always update
            //give 500 error
            $scope.$apply(function(){
                $scope.tracks = tracks;
            });
        });
    };

});

/*
 * Handles listing online users and when a user clicks on a username to listen 
 * in with
 */
geekinViewControllers.controller('listenViewCtrl', function($scope, Data, $firebase, playbarData){
    var fbOnlineUsersRef = new Firebase("https://geekinapp.firebaseio.com/onlineusers");
    var fbStationRef = new Firebase("https://geekinapp.firebaseio.com/station");
    var onlineusers = $firebase(fbOnlineUsersRef).$asArray();
    $scope.users = onlineusers;
    console.log("online users");
    console.log(onlineusers);
    $scope.listenTo = function(user){
        //initiate playing
        console.log("clicked on ", user);
        //need to prep for broadcast and get what the broadcaster is playing
        var broadcasterDataRef = $firebase(fbStationRef.child(user)).$asObject();
        broadcasterDataRef.$loaded().then(function(data){
            console.log(data.currentlyPlaying);
            //trigger the playbar to play music
            $scope.playbarData = playbarData;
            $scope.playbarData.currentlyListeningToo = user;

            //prepForBroadcast expects an object with property .id 
            var trackData = {};
            trackData.id = data.currentlyPlaying;
            $scope.playbarData.prepForBroadcast(trackData, $scope.playbarData.currentlyListeningToo);
        });
    };
});


