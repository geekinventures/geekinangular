/**
 * Created by barre_000 on 1/5/2015.
 */
/*
 * Handles the playback and control of sound and synchronization
 * writes to firebase database and turns the users as 'online' when playing music
 */
geekinViewControllers.controller('playBarCtrl', function($scope, $timeout, Data, playbarData, $element, $firebase, FIREBASE_URL){

    // contains the list of online users
    var fbRef = new Firebase(FIREBASE_URL+'onlineusers');

    // contains the broadcast data, song info, and server synch time.
    var fbStationRef = new Firebase(FIREBASE_URL+'station');
    $scope.hasBegunPlayingSong = false; //set init song playback value to false

    $scope.$on('userHasLoggedIn', function(){
        // === Shared Controller Data variables === //
        $scope.Data = Data;
        $scope.fbData = $firebase(fbRef.child($scope.Data.username)); // this is the users station info
        console.log("playbar loaded");
        var newSkew = new Firebase(FIREBASE_URL+".info/serverTimeOffset");
        var skewTime = $firebase(newSkew).$asObject();
        console.log("skewArray", skewTime);

        //set initial status to offline until user clicks 'play'

        $scope.fbData.$set({online:false, lastSeen:new Date().getTime()}).then(function(ref){
            var id = ref.key();
            console.log("init online status set to false for user", id);
        });
    });




    $scope.currentSong = null;

    //once the playbar receives the playsong event it will start loading
    //and playing the song that was set either from searchview or listenview
    //auto playing does not work on iOS this must be done through another event
    $scope.$on('startPlayingSong', function(event){
        Data.prepForDataEmit(0,0); //reset playbar
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

        SC.stream("/tracks/"+trackId, function(sound){
            $scope.currentSong = sound; //give access to the song for pause/play
            $scope.currentSong.load({
                whileloading: function(){
                    //notify the other controllers that data has loaded
                    Data.prepForDataEmit(this.bytesLoaded/this.bytesTotal*100, this.bytesTotal);
                }
            });
        });
    };

    //iOS devices do not allow onload function so we have to manually
    $scope.play = function(){
        console.log("Prepping for song playback");
        console.log($scope.currentSong.position);
        //update server and set the current start time for the broadcaster
        $scope.fbData.$update({online: $scope.currentSong.paused, lastSeen: new Date().getTime()});


        //reset playbar data to zero
        Data.prepForDataEmit(0,0);
        if($scope.currentSong.position > 0){
            console.log("song is already playing");

            //recalc song position
            var skewRef = new Firebase(FIREBASE_URL + ".info/serverTimeOffset");
            skewRef.once('value', function(snapshot){
                var skew = new Date().getTime() + snapshot.val();
                console.log("skew data", skew, snapshot.val());
                var userRef = new Firebase(FIREBASE_URL + "station/" + $scope.playbarData.currentlyListeningToo);
                userRef.once('value', function(snap){
                    $scope.currentSong.setPosition(skew - snap.val().server_time);
                    console.log("current position paused", $scope.currentSong.position);
                    console.log("skew info", skew - snap.val().server_time);

                    $scope.currentSong.togglePause();
                    playbarData.isSongPaused = $scope.currentSong.paused;
                });
            });
        } // if songposition === 0
        if($scope.currentSong.position === null) {
            playbarData.currentSong = $scope.currentSong;
            //set time on start to server
            $scope.fbStationData.$set({currentlyPlaying:$scope.playbarData.currentTrackData.id,
                server_time:Firebase.ServerValue.TIMESTAMP});
            //skew time calculates how far off the client time is from the server
            //this is a crucial calculation and it enables the synchronization to work
            var skewRef = new Firebase(FIREBASE_URL + ".info/serverTimeOffset");
            skewRef.once('value', function (snapshot) {
                //console.log(snapshot.val());
                var skew = new Date().getTime() + snapshot.val();
                //console.log("skew", skew);
                var userRef = new Firebase(FIREBASE_URL + "station/" + $scope.playbarData.currentlyListeningToo);
                userRef.once('value', function (snap) {
                    console.log("should start here", skew - snap.val().server_time);
                    var syncLimit = 0;
                    console.log("starting playback of this song");
                    console.log($scope.currentSong);
                    $scope.currentSong.play({
                        whileplaying: function () {
                            $timeout(function(){
                                //var syncLimit = 0;
                                if(syncLimit < 1){
                                    syncLimit += 1;
                                    $scope.currentSong.setPosition(skew - snap.val().server_time);
                                    $scope.fbData.$update({online: true, lastSeen: new Date().getTime()});
                                }
                            }, 5000);
                            //tell the status bar to update
                            //console.log(this.position/this.duration*100);
                            Data.prepForDataEmit(this.position / this.duration * 100, this.duration);
                        }
                    });
                });
            });
        }// if scope === null condition
    }; //play
});