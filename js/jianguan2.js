/**
 * Created by sban on 2017/5/15.
 */

function checkFollowMe() {
    //FollowStatus
    var followme = false
    var btns = document.getElementsByClassName("FollowStatus");
    
    if (btns.length == 0) {//还没有关注我
        // FollowButton
        // alert(1)
        var btns = document.getElementsByClassName("FollowButton");
        if (btns.length > 0) {
            // alert(1)
            var btn = btns[0]
            btn.click();
        }
    }else{
        followme = true
    }
    // var link = window.location.href;
    setTimeout(function () {
        chrome.runtime.sendMessage({"unfollowcomplete":true,"followme":followme});
    },2500);
}

checkFollowMe()