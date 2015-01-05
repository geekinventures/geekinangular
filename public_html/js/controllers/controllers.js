/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var geekinViewControllers = angular.module('geekinViewControllers', []);

/*
 * ==== Factories =====
 *
 * Data that is centrally shared throughout the application. Stores user specific
 * information such as username.  
 */
geekinViewControllers.factory('Data', function($rootScope){
    var sharedService = {};
    sharedService.username = 'liltimtim' + Math.random().toString().replace('.','') ; //this is temporary will be setup on login
    sharedService.message = '';
    sharedService.songId = '';
    sharedService.tracks = [];
    sharedService.bytesLoaded = 0;
    sharedService.bytesTotal = 0;
    
    //===== Ingest Data =====
    sharedService.prepForDataEmit = function(loaded, total){
        this.bytesLoaded = loaded;
        this.bytesTotal = total;
        this.broadcastSongData()();
    };
    sharedService.prepForBroadcast = function(msg){
        this.message = msg;
        this.broadcastItem();
    };
    
    //==== notify other controllers that are listening for events =====
    sharedService.broadcastItem = function(){
        $rootScope.$broadcast('handleBroadcast');
    };
    sharedService.broadcastSongData = function(){
        $rootScope.$broadcast('bytesLoaded');
    };
    return sharedService;
});

/*
 * Contains all the relative data required to play a song and who the user is 
 * listening too.  Every user will be 'listening' to someone either themselves
 * or someone else due to the way synchronization works.  
 * 
 * A user must subscribe to themselves because they will have to synchronize with
 * the servers time instead of their own client time to ensure broadcaster and
 * listener are always in sync with each other. 
 */
geekinViewControllers.factory('playbarData', function($rootScope){
    var playbarService = {};
    playbarService.currentTrackData = null; //holds the SC track info
    playbarService.currentlyListeningToo = null;
    
    playbarService.prepForBroadcast = function(trackData, listeningToo){
        playbarService.currentTrackData = trackData;
        playbarService.currentlyListeningToo = listeningToo;
        playbarService.notifyPlayBarToPlaySong();
    };
    playbarService.notifyPlayBarToPlaySong = function(){
        $rootScope.$broadcast('startPlayingSong');
    };
    return playbarService;
});

/*
 * Shared watchers of firebase.  
 * Watches for pause/play events, song changes, and number of listeners
 * currently attached to your broadcast! 
 */
geekinViewControllers.factory('firebaseWatch', function($rootScope, $firebase){
    var firebaseWatchService = {};
    firebaseWatchService.pausePlayEvent = false;
    firebaseWatchService.listenerCountHasChangedTo = 0;
    
    firebaseWatchService.remotePlayEventOccurred = function(){
        $rootScope.$broadcast('remotePausePlayEvent', firebaseWatchService.pausePlayEvent);
    };
});
// === End Factories ======

// === Directives =====
//handles the pause/play button switching glyphs
geekinViewControllers.directive('playbarWidget', function(){
    var linkFunction = function($scope, $element, $attributes){
        var glyphIcon = $element.children().children();
        $(glyphIcon).on("click", function(e){
            if($scope.isPlaying === false){
                $(this).attr("class", "glyphicon glyphicon-pause");
            }
            if($scope.isPlaying === true){
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
geekinViewControllers.controller('mainCtrl', ['$route','$window', '$routeParams', '$location', '$scope', function($route, $window, $routeParams, $location, $scope){
    $scope.whereAmI = "main view controller";    
}]);

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
        SC.get('/tracks', {q: params, bpm:{from: 10}}, function(tracks){
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
geekinViewControllers.controller('playlistViewCtrl', function($scope){
    
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

/*
 * Handles the playback and control of sound and synchronization
 * writes to firebase database and turns the users as 'online' when playing music
 */
geekinViewControllers.controller('playBarCtrl', function($scope, Data, playbarData, $element, $firebase){
    var playBtnToggled = false; //because pausing is diffucult need to track when the user presses play vs. when they want to pause
    // contains the list of online users
    var fbRef = new Firebase('https://geekinapp.firebaseio.com/onlineusers');
    
    // contains the broadcast data, song info, and server synch time.
    var fbStationRef = new Firebase('https://geekinapp.firebaseio.com/station');
    
    // === Shared Controller Data variables === //
    $scope.Data = Data;
    $scope.fbData = $firebase(fbRef.child($scope.Data.username)); // this is the users station info

    var newSkew = new Firebase("https://geekinapp.firebaseio.com/.info/serverTimeOffset");    
    var skewTime = $firebase(newSkew).$asObject();
    
    //set initial status to offline until user clicks 'play' 
    $scope.fbData.$set({online:false}).then(function(ref){
        var id = ref.key();
        console.log("init online status set to false for user", id);
    });

    $scope.currentSong = null;
    
    //once the playbar receives the playsong event it will start loading
    //and playing the song that was set either from searchview or listenview
    //auto playing does not work on iOS this must be done through another event
    $scope.$on('startPlayingSong', function(event){
        $scope.playbarData = playbarData;

        //init playing of track
        $scope.loadTrack($scope.playbarData.currentTrackData.id);
        
        //update user history
        var historyAdd = {};
        historyAdd[Date.now()] = $scope.playbarData.currentTrackData.toString();
        //add this song to the user history
        var updateHistory = $firebase(fbStationRef.child(Data.username).child('history')).$asArray();
        updateHistory.$add(historyAdd);
    }, true);
    
    //listen for full song load 
    //this doesn't work on ios devices
    $scope.$on('bytesLoaded', function(){
        if(Data.bytesLoaded === 100){
            console.log("Song has completely loaded");
            alert("song loaded");
        }
    }, true);
    
    $scope.loadTrack = function(trackId){
        //tell firebase the user has started listening to music
        $scope.fbStationData = $firebase(fbStationRef.child(Data.username));
        $scope.fbStationData.$set({currentlyPlaying:$scope.playbarData.currentTrackData.id,
                                    server_time:Firebase.ServerValue.TIMESTAMP});
        //destroy a song if there is one already playing
        if($scope.currentSong !== null){
            $scope.currentSong.destruct();
        }
       
        //SC requires authentication before being able to play
        SC.initialize({
            client_id:'0f0e321b9652115f3a8ea04f5030f9c0'
        });
        /* === disabled for testing firebase services === */
        SC.stream("/tracks/"+trackId, function(sound){
            $scope.currentSong = sound; //give access to the song for pause/play
            $scope.currentSong.load({
                whileloading: function(){
                    //notify the other controllers that data has loaded
                    Data.prepForDataEmit(this.bytesLoaded/this.bytesTotal*100, this.bytesTotal);
                }
            });
        });
    }; //playTrack
    
    //iOS devices do not allow onload function so we have to manually 
    //start the song once it's loaded completely.
    $scope.play = function(){
        console.log("play song triggered");
        //when user plays they will re-sync with server and calculate the 
        //correct position to start at
               
        //determine if a song is playing or not.  If a song is playing it will
        //decide to either start the song (ios requires user action to start 
        //a song) or togglePause
        if(playBtnToggled === false){
            //song has not been played yet
            playBtnToggled = true;
            $scope.isPlaying = $scope.currentSong.paused;
            $scope.fbData.$update({online:!$scope.currentSong.paused});
            $scope.getTrackSyncPosition();
        }

        if(playBtnToggled === true){
//            $scope.currentSong.togglePause();
            //reset sync time and reposition
            $scope.fbData.$update({online:!$scope.currentSong.paused});
        }
    }; //play 
    
    $scope.getTrackSyncPosition = function(){
        //skew time
        var skewRef = new Firebase("https://geekinapp.firebaseio.com/.info/serverTimeOffset");
        skewRef.once('value', function(snapshot){
            console.log(snapshot.val());
            var skew = new Date().getTime() + snapshot.val();
            console.log("skew", skew);
            var userRef = new Firebase("https://geekinapp.firebaseio.com/station/"+$scope.playbarData.currentlyListeningToo);
            userRef.once('value', function(snap){
                console.log(snap.val());
                console.log("should start here", skew - snap.val().server_time);
                var syncLimit = 0;
                
                $scope.currentSong.play({
                    whileplaying: function(){
                        if(syncLimit < 5){
                            syncLimit += 1;
                            this.setPosition(skew-snap.val().server_time);
                        }
                        Data.prepForDataEmit(this.position, this.duration);
                    }
                });
            });
        });
    };

    //remove later
    $scope.pauseTrack = function(){
        if($scope.currentSong !== null){
            $scope.currentSong.togglePause();
            $scope.isPlaying = $scope.currentSong.paused;
        }else{
            alert("You aren't playing any song");
        }
    };

});
