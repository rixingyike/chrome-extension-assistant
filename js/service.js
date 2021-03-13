/**
 * 将所有接口放在这里，挂在window.service上，在bg中可以直接使用
 */

const API_BASE_DOMAIN = 'http://localhost:8080'

export default {
    getTestUrl: () => {
        //     call api http://t.weather.sojson.com/api/weather/city/101030100
        // 在bg中可以正常请求
        $.ajax({
            url: "http://t.weather.sojson.com/api/weather/city/101030100"
            , success: res => {
                console.log("res", res);

            }, error: (xhr, err) => {
                console.log("err", err);

            }
        })
    },
    toutiao: {
        // 查询当天有多少额度，头条200限制，
        getNumLastFollowToday: () => {
            return new Promise((resovle, reject) => {
                $.ajax({
                    url:`${API_BASE_DOMAIN}/config/numlastfollow/toutiao`
                    ,dataType: 'json'
                    ,type:'GET'
                }).success(res => {
                    // console.log("ajax res", res);
                    resovle(res)
                }).error(err => {
                    console.log("ajax err", err);
                    reject(err)
                })
            })
        },
        // 查询state0，待关注人数，从db中
        getNumOfWillFollowUsers: () => {
            return new Promise((resovle, reject) => {
                $.ajax({
                    url:`${API_BASE_DOMAIN}/toutiao/maxnumofuserswillfollow`
                    ,dataType: 'json'
                    ,type:'GET'
                }).success(res => {
                    // console.log("ajax res", res);
                    resovle(res)
                }).error(err => {
                    console.log("ajax err", err);
                    reject(err)
                })
            })
        },
        // followuser
        followUser: (id) => {
            return new Promise((resovle, reject) => {
                $.ajax({
                    url:`${API_BASE_DOMAIN}/toutiao/followuser/${id}`
                    ,dataType: 'json'
                    ,data: JSON.stringify( {})
                    ,type:'PUT'
                }).success(res => {
                    // console.log("ajax res", res);
                    resovle(res)
                }).error(err => {
                    console.log("ajax err", err);
                    reject(err)
                })
            })
        },
        getNotFollowedUsers: (num) => {
            return new Promise((resovle, reject) => {
                $.ajax({
                    url:`${API_BASE_DOMAIN}/toutiao/notusers/${num}`
                    ,dataType: 'json'
                    ,type:'GET'
                }).success(res => {
                    // console.log("ajax res", res);
                    resovle(res)
                }).error(err => {
                    console.log("ajax err", err);
                    reject(err)
                })
            })
        },
        postUsers: (users) => {
            return new Promise((resovle, reject) => {
                $.ajax({
                    url:`${API_BASE_DOMAIN}/toutiao/users`
                    ,data: JSON.stringify( users)
                    ,dataType: 'json'
                    ,type:'POST'
                }).success(res => {
                    // console.log("ajax res", res);
                    resovle(res)
                }).error(err => {
                    console.log("ajax err", err);
                    reject(err)
                })
            })
        }
    }
}