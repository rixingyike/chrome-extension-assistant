package controllers

import (
	"fmt"
	models "wemedia_assistant/models"
	"github.com/kataras/iris/v12"
	"github.com/go-xorm/xorm"
	"time"
)

// 如果首字母用小写，外面访问
type ToutiaoController struct{
	Ctx iris.Context
	Db *xorm.Engine
}

type Response struct {
	Message string `json:"message"`
	Code int  `json:"code"`
	Data interface{}  `json:"data"`
}

// curl http://localhost:8080/toutiao/
func (c *ToutiaoController) Get() Response {
	return Response{
		Message: "ok",
	}
}

// curl http://localhost:8080/toutiao/list/1
func (c *ToutiaoController) GetListBy(page int) Response {
	return Response{
		Message: "get list " + fmt.Sprintf("%d", page),
	}
}

// 查询state0，待关注人数，从db中
// curl http://localhost:8080/toutiao/maxnumofuserswillfollow
func (c *ToutiaoController) GetMaxnumofuserswillfollow() Response {
	var res = Response{
		Message: "",
	}
	user := new(models.ToutiaoUser)
	if total, err := c.Db.Where("state = 0").Count(user); err == nil {
		res.Code = 1
		res.Data = total
	}
	return res
}
// 设置当前日期关注总数字+1
func (c *ToutiaoController) PlusTodayFollowNum() int {
	config := new(models.Config)
	if has, _ := c.Db.Where("`name` = 'toutiao'").Get(config); has {
		// fmt.Println("%v",config)
		todayTimeStr := time.Now().Format("2006-01-02")//去小时分钟
		if config.LastFollowDate == todayTimeStr {
			config.NumLastFollow++
		}else{
			config.LastFollowDate = todayTimeStr
			config.NumLastFollow = 1
		}
		// fmt.Println("%s",todayTimeStr)
		c.Db.Id(config.Id).Cols("last_follow_date","num_last_follow").Update(config)
	}
	// else{
	// 	fmt.Println("%v %v",has,err)
	// }
	
	return config.NumLastFollow
}

// 唯一设置关注的接口
// 将用户设置为已关注
// curl -i -X PUT http://localhost:8080/toutiao/followuser/345
func (c *ToutiaoController) PutFollowuserBy(id int64) Response {
	var res = Response{
		Message: "",
	}
	user := new(models.ToutiaoUser)
	if has, _ := c.Db.Id(id).Get(user); has {
		if user.State != 1{
			user.State = 1
			if affected, _ := c.Db.Id(id).Cols("state").Update(user); affected > 0 {
				res.Data = user
				res.Code = 1
				c.PlusTodayFollowNum()
			}
		}
	}
	
	return res
}

// 查取一个数量的未关注用户
// http://localhost:8080/toutiao/notusers/200
func (c *ToutiaoController) GetNotusersBy(num int) Response {
	var res = Response{
		Message: "",
	}
	users := make([]models.ToutiaoUser, 0)
	// 第一个参数为条数，第二个参数表示开始位置，如果不传则为0
	if err := c.Db.Where("state = 0").Desc("id").Limit(num).Find(&users); err != nil {
		fmt.Println("%v", err)
	}

	res.Data = users
	res.Code = 1
	return res
}

// 批量添加新需要关注的用户列表，需要检查库中是否已有
func (c *ToutiaoController) PostUsers() Response {
	var res = Response{
		Message: "",
	}
	var users []models.ToutiaoUser

	if err := c.Ctx.ReadJSON(&users); err != nil {
		c.Ctx.StatusCode(iris.StatusBadRequest)
		return res
	}
	// fmt.Println("users",users)
	var numCompleted = 0
	for _, user := range users {
		if has, _ := c.Db.Exist(&models.ToutiaoUser{Uid:user.Uid}); has {
			fmt.Println("exist yet")
			continue
		}
		// fmt.Println("%v", user)
		// 自己主动关注的，互动值5，有5次互动机会，别人主动关注我，有8次互动值
		// 这个值放在前端主动填写
		// user.InteractiveValue = 5
		user.State = 0
		c.Db.Insert(&user)
		numCompleted++
	}

	res.Message = fmt.Sprintf("新增了%d条记录", numCompleted)
	res.Data = numCompleted
	res.Code = 1
	return res
}

/**
type UsersController struct {
	// Optionally: context is auto-binded by Iris on each request,
	// remember that on each incoming request iris creates a new UserController each time,
	// so all fields are request-scoped by-default, only dependency injection is able to set
	// custom fields like the Service which is the same for all requests (static binding).
	Ctx iris.Context

	// Our UserService, it's an interface which
	// is binded from the main application.
	Service services.UserService
}

// Get returns list of the users.
// Demo:
// curl -i -u admin:password http://localhost:8080/users
//
// The correct way if you have sensitive data:
// func (c *UsersController) Get() (results []viewmodels.User) {
// 	data := c.Service.GetAll()
//
// 	for _, user := range data {
// 		results = append(results, viewmodels.User{user})
// 	}
// 	return
// }
// otherwise just return the datamodels.
func (c *UsersController) Get() (results []datamodels.User) {
	return c.Service.GetAll()
}

// GetBy returns a user.
// Demo:
// curl -i -u admin:password http://localhost:8080/users/1
func (c *UsersController) GetBy(id int64) (user datamodels.User, found bool) {
	u, found := c.Service.GetByID(id)
	if !found {
		// this message will be binded to the
		// main.go -> app.OnAnyErrorCode -> NotFound -> shared/error.html -> .Message text.
		c.Ctx.Values().Set("message", "User couldn't be found!")
	}
	return u, found // it will throw/emit 404 if found == false.
}

// PutBy updates a user.
// Demo:
// curl -i -X PUT -u admin:password -F "username=kataras"
// -F "password=rawPasswordIsNotSafeIfOrNotHTTPs_You_Should_Use_A_client_side_lib_for_hash_as_well"
// http://localhost:8080/users/1
func (c *UsersController) PutBy(id int64) (datamodels.User, error) {
	// username := c.Ctx.FormValue("username")
	// password := c.Ctx.FormValue("password")
	u := datamodels.User{}
	if err := c.Ctx.ReadForm(&u); err != nil {
		return u, err
	}

	return c.Service.Update(id, u)
}

// DeleteBy deletes a user.
// Demo:
// curl -i -X DELETE -u admin:password http://localhost:8080/users/1
func (c *UsersController) DeleteBy(id int64) interface{} {
	wasDel := c.Service.DeleteByID(id)
	if wasDel {
		// return the deleted user's ID
		return map[string]interface{}{"deleted": id}
	}
	// right here we can see that a method function
	// can return any of those two types(map or int),
	// we don't have to specify the return type to a specific type.
	return iris.StatusBadRequest // same as 400.
}
*/