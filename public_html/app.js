/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var geekinApp = angular.module('geekinApp', ['ngRoute', 'geekinViewControllers', 'firebase']);

geekinApp.config(['$routeProvider', function($routeProvider){
        $routeProvider.
                when('/search', {
                    templateUrl: 'template/searchView.html',
                    controller: 'searchViewCtrl'
                }).
                when('/listen', {
                    templateUrl: 'template/listenView.html',
                    controller: 'listenViewCtrl',
                }).
                when('/playlists', {
                    templateUrl: 'template/playlistView.html',
                    controller: 'playlistViewCtrl',
                }).
                otherwise({
                    redirectTo: '/'
                });
}]);

//---this method works for desktop stuff but not iphone---
//$(window).bind('beforeunload', function(e){
//    if(confirm){
//        return "are you sure?";
//    }
//});