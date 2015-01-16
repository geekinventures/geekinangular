/**
 * Created by barre_000 on 1/5/2015.
 */

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
    playbarService.isSongPaused = true;
    playbarService.currentSong = null;

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