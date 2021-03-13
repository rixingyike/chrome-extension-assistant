'use strict';

// import {injectFunction} from './my-script.js';
// window.injectFunction = injectFunction;

// function injectFunction(cmd,options){ 
//     window.alert('hello world');
//     return 'ok'+cmd
// }

// define(function (){

//     　　　　var add = function (x,y){
    
//     　　　　　　return x+y;
    
//     　　　　};
    
//     　　　　return {
    
//     　　　　　　add: add
//     　　　　};
    
//     　　});

// 'use strict';

    import {injectFunction} from './my-script.js';
    function fetchUsers() {
        window.scrollBy(0,200)
        return document.querySelector("div.w-feed-container").children
      }
    window.tuotiao = {injectFunction,fetchUsers};