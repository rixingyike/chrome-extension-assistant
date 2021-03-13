package main

import (
	// "time"
	"fmt"
	"github.com/go-xorm/xorm"
	// _ "github.com/mattn/go-sqlite3"
	"github.com/kataras/iris/v12"
	"github.com/kataras/iris/v12/mvc"
	"github.com/kataras/iris/v12/middleware/recover"
	// "github.com/kataras/iris/v12/sessions"
	controllers "wemedia_assistant/controllers"
	models "wemedia_assistant/models"
	_ "github.com/go-sql-driver/mysql"
)

var db *xorm.Engine

func main() {
	app := iris.Default()
	app.Use(recover.New())
	// app.Use(myMiddleware)
	// app.RegisterView(iris.HTML("./views", ".html"))

	app.Get("/", func(ctx iris.Context) {
        // Bind: {{.message}} with "Hello world!"
        // ctx.ViewData("message", "Hello world!")
        // Render template file: ./views/hello.html
        ctx.JSON(iris.Map{"message": "pong"})
	})

	// 	* 自动检测和创建表，这个检测是根据表的名字
	// * 自动检测和新增表中的字段，这个检测是根据字段名，同时对表中多余的字段给出警告信息
	// * 自动检测，创建和删除索引和唯一索引，这个检测是根据索引的一个或多个字段名，而不根据索引名称。因此这里需要注意，如果在一个有大量数据的表中引入新的索引，数据库可能需要一定的时间来建立索引。
	// * 自动转换varchar字段类型到text字段类型，自动警告其它字段类型在模型和数据库之间不一致的情况。
	// * 自动警告字段的默认值，是否为空信息在模型和数据库之间不匹配的情况
	db, err := xorm.NewEngine("mysql", "root:liyi@tcp(127.0.0.1:3306)/chrome_extension_assistant?charset=utf8mb4")
	if err != nil {
		fmt.Printf("err %s", err)
	}
	db.Sync2(new(models.ToutiaoUser),new(models.Config))

	iris.RegisterOnInterrupt(func() {
		db.Close()
	})

	tuotiao := mvc.New(app.Party("/toutiao"))
	tuotiao.HandleError(func(ctx iris.Context, err error) {
		ctx.HTML(fmt.Sprintf("<b>%s</b>", err.Error()))
	})
	tuotiao.Register(db)
	tuotiao.Handle(new(controllers.ToutiaoController))

	config := mvc.New(app.Party("/config"))
	config.Register(db)
	config.Handle(new(controllers.ConfigController))

	// // "/users" based mvc application.
	// users := mvc.New(app.Party("/users"))
	// // Add the basic authentication(admin:password) middleware
	// // for the /users based requests.
	// users.Router.Use(middleware.BasicAuth)
	// // Bind the "userService" to the UserController's Service (interface) field.
	// users.Register(userService)
	// users.Handle(new(controllers.UsersController))

	// curl http://localhost:8080/user2/ly/insert -X POST -H "Content-Type:application/json" -d '{}'
	// app.Post("/user2/{name:string}/insert", func(ctx iris.Context) {
    //     user := &User2{Name:ctx.Params().Get("name")}
	// 	orm.Insert(user)
	// 	ctx.Writef("user inserted: %#v", user)
	// })

	// // curl http://localhost:8080/user2/ly
	// app.Get("/user2/{name}", func(ctx iris.Context) {
    //     user := User2{ID: 1}
	// 	if ok, _ := orm.Get(&user); ok {
	// 		ctx.Writef("user found: %#v", user)
	// 	}
	// })

    // Listens and serves incoming http requests
    // on http://localhost:8080/ping
	app.Listen(":8090")
		
	// app.Handle("GET", "/contact", func(ctx iris.Context) {
	// 	ctx.HTML("<h1> Hello from /contact </h1>")
	// })

    // app.Handle("GET", "/ping", func(ctx iris.Context) {
    //     ctx.JSON(iris.Map{"message": "pong"})
	// })

	// This handler will match /user/john but will not match neither /user/ or /user.
    // app.Get("/user/{name}", func(ctx iris.Context) {
    //     name := ctx.Params().Get("name")
    //     ctx.Writef("Hello %s", name)
    // })

    // This handler will match /users/42
    // but will not match /users/-1 because uint should be bigger than zero
    // neither /users or /users/.
    // app.Get("/users/{id:uint64}", func(ctx iris.Context) {
    //     id := ctx.Params().GetUint64Default("id", 0)
    //     ctx.Writef("User with ID: %d", id)
    // })

    // However, this one will match /user/john/send and also /user/john/everything/else/here
    // but will not match /user/john neither /user/john/.
    // app.Get("/user/{name:string}/{action:path}", func(ctx iris.Context) {
    //     name := ctx.Params().Get("name")
    //     action := ctx.Params().Get("action")
    //     message := name + " is " + action
    //     ctx.WriteString(message)
	// })
	// curl 
	// curl http://localhost:8080/slice -X POST -H "Content-Type:application/json" -d '{"name":"ly","city":"bj","other":123}'

	// app.Post("/slice", MyHandler)

	// sqlite3 db

	// orm, err := xorm.NewEngine("sqlite3", "./test.db")
	// if err != nil {
	// 	app.Logger().Fatalf("orm failed to initialized: %v", err)
	// }

	

	// err = orm.Sync2(new(User))

	// if err != nil {
	// 	app.Logger().Fatalf("orm failed to initialized User table: %v", err)
	// }

	// curl http://localhost:8080/user/ly/insert -X POST -H "Content-Type:application/json" -d '{}'
	// app.Post("/user/{name:string}/insert", func(ctx iris.Context) {
    //     user := &User{Username: "ly", Salt: "hash---", Password: "hashed", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	// 	orm.Insert(user)
	// 	ctx.Writef("user inserted: %#v", user)
	// })

	// curl http://localhost:8080/user/ly
	// app.Get("/user/{name}", func(ctx iris.Context) {
    //     user := User{ID: 1}
	// 	if ok, _ := orm.Get(&user); ok {
	// 		ctx.Writef("user found: %#v", user)
	// 	}
	// })
	
	// 
	
	// curl --location --request GET 'http://localhost:8080/my/path_segment_1/path_segment_2'
	// mvc.New(app.Party("/my")).Handle(new(controllers.MyController))

	// Same as:
	// usersRouter.Get("/{p:path}", func(ctx iris.Context) {
	// 	wildcardPathParameter := ctx.Params().Get("p")
	// 	ctx.JSON(response{
	// 		Message: "The path parameter is: " + wildcardPathParameter,
	// 	})
	// })

	// var err error
}

	// 这是因为 server.go 中使用 internal package 的方法跟以前已经不同了，
	// 由于 go.mod会扫描同工作目录下所有 package 并且变更引入方法，必须将 helloworld当成路径的前缀，
	// 也就是需要写成 import helloworld/api，以往 GOPATH/dep 模式允许的 import ./api 已经失效，详情可以查看这个

/**
接口方法

// Method: "GET"
app.Get("/", handler)

// Method: "POST"
app.Post("/", handler)

// Method: "PUT"
app.Put("/", handler)

// Method: "DELETE"
app.Delete("/", handler)

// Method: "OPTIONS"
app.Options("/", handler)

// Method: "TRACE"
app.Trace("/", handler)

// Method: "CONNECT"
app.Connect("/", handler)

// Method: "HEAD"
app.Head("/", handler)

// Method: "PATCH"
app.Patch("/", handler)

// register the route for all HTTP Methods
app.Any("/", handler)
*/

/*
	go get -u github.com/mattn/go-sqlite3
	go get -u github.com/go-xorm/xorm
	If you're on win64 and you can't install go-sqlite3:
		1. Download: https://sourceforge.net/projects/mingw-w64/files/latest/download
		2. Select "x86_x64" and "posix"
		3. Add C:\Program Files\mingw-w64\x86_64-7.1.0-posix-seh-rt_v5-rev1\mingw64\bin
		to your PATH env variable.
	Docs: http://xorm.io/docs/
*/

// User is our user table structure.
// type User struct {
// 	ID        int64  // auto-increment by-default by xorm
// 	Version   string `xorm:"varchar(200)"`
// 	Salt      string
// 	Username  string
// 	Password  string    `xorm:"varchar(200)"`
// 	Languages string    `xorm:"varchar(200)"`
// 	CreatedAt time.Time `xorm:"created"`
// 	UpdatedAt time.Time `xorm:"updated"`
// }

// type Company struct {
// 	Name  string `json:"name"`
// 	City  string `json:"city"`
// 	Other int `json:"other"`
// }

// func MyHandler(ctx iris.Context) {
// 	var c Company

// 	if err := ctx.ReadJSON(&c); err != nil {
// 		ctx.StatusCode(iris.StatusBadRequest)
// 		ctx.WriteString(err.Error())
// 		return
// 	}

// 	ctx.Writef("Received: %#+v\n", c)
// }

// type User2 struct {
//     ID int64
//     Name string
//     CreatedAt int64 `xorm:"created"`
// }

// type myController struct{}

// type response struct {
// 	Message string `json:"message"`
// }

// func (c *myController) GetByWildcard(wildcardPathParameter string) response {
// 	return response{
// 		Message: "The path parameter is: " + wildcardPathParameter,
// 	}
// }

// func basicMVC(app *mvc.Application) {
// 	// You can use normal middlewares at MVC apps of course.
// 	app.Router.Use(func(ctx iris.Context) {
// 		ctx.Application().Logger().Infof("Path: %s", ctx.Path())
// 		ctx.Next()
// 	})

	// Register dependencies which will be binding to the controller(s),
	// can be either a function which accepts an iris.Context and returns a single value (dynamic binding)
	// or a static struct value (service).
	// app.Register(
	// 	sessions.New(sessions.Config{}).Start,
	// 	&prefixedLogger{prefix: "DEV"},
	// )

	// GET: http://localhost:8080/basic
	// GET: http://localhost:8080/basic/custom
	// GET: http://localhost:8080/basic/custom2
	// app.Handle(new(basicController))

	// All dependencies of the parent *mvc.Application
	// are cloned to this new child,
	// thefore it has access to the same session as well.
	// GET: http://localhost:8080/basic/sub
	// app.Party("/sub").
	// 	Handle(new(basicSubController))
// }

// type prefixedLogger struct {
// 	prefix string
// }
// func (s *prefixedLogger) Log(msg string) {
// 	fmt.Printf("%s: %s\n", s.prefix, msg)
// }

// type basicSubController struct {
// 	Session *sessions.Session
// }

// http://localhost:8080/basic/sub
// func (c *basicSubController) Get() string {
// 	count := c.Session.GetIntDefault("count", 1)
// 	return fmt.Sprintf("Hello from basicSubController.\nRead-only visits count: %d", count)
// }

// type basicController struct {
// 	Logger LoggerService

// 	Session *sessions.Session
// }

// type LoggerService interface {
// 	Log(string)
// }

// http://localhost:8080/basic/custom/custom2
// func (c *basicController) BeforeActivation(b mvc.BeforeActivation) {
// 	b.HandleMany("GET", "/custom/custom2", "Custom")
// }

// func (c *basicController) AfterActivation(a mvc.AfterActivation) {
// 	if a.Singleton() {
// 		panic("basicController should be stateless, a request-scoped, we have a 'Session' which depends on the context.")
// 	}
// }

// http://localhost:8080/basic
// func (c *basicController) Get() string {
// 	count := c.Session.Increment("count", 1)

// 	body := fmt.Sprintf("Hello from basicController\nTotal visits from you: %d", count)
// 	c.Logger.Log(body)
// 	return body
// }

// func (c *basicController) Custom() string {
// 	return "custom"
// }

// func myMiddleware(ctx iris.Context) {
//     ctx.Application().Logger().Infof("Runs before %s", ctx.Path())
//     ctx.Next()
// }