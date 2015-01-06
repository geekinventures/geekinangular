/**
 * Created by barre_000 on 1/5/2015.
 */
/*
 * Handles the playback and control of sound and synchronization
 * writes to firebase database and turns the users as 'online' when playing music
 */
geekinViewControllers.controller('playBarCtrl', function($scope, Data, playbarData, $element, $firebase){
    var playBtnToggled = false; //because pausing is diffucult need to track when the user presses play vs. when they want to pause
    // contains the list of online users
    var fbRef = new Firebase(FIREBASE_URL+'onlineusers');

    // contains the broadcast data, song info, and server synch time.
    var fbStationRef = new Firebase(FIREBASE_URL+'station');

    // === Shared Controller Data variables === //
    $scope.Data = Data;
    $scope.fbData = $firebase(fbRef.child($scope.Data.username)); // this is the users station info

    console.log("playbar loaded");
    var newSkew = new Firebase(FIREBASE_URL+".info/serverTimeOffset");
    var skewTime = $firebase(newSkew).$asObject();
    console.log("skewArray", skewTime);

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
        //reset playbar data to zero
        Data.prepForDataEmit(0,0);

        //skew time
        var skewRef = new Firebase(FIREBASE_URL+".info/serverTimeOffset");
        skewRef.once('value', function(snapshot){
            //console.log(snapshot.val());
            var skew = new Date().getTime() + snapshot.val();
            //console.log("skew", skew);
            var userRef = new Firebase(FIREBASE_URL+"station/"+$scope.playbarData.currentlyListeningToo);
            userRef.once('value', function(snap){
                console.log("should start here", skew - snap.val().server_time);
                var syncLimit = 0;
                $scope.currentSong.play({
                    whileplaying: function(){
                        if(syncLimit < 5){
                            syncLimit += 1;
                            this.setPosition(skew-snap.val().server_time);
                        }
                        //tell the status bar to update
                        Data.prepForDataEmit(this.position, this.duration);
                    }
                });
            });
        });
    };
});