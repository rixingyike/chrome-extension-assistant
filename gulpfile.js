// var gulp = require("gulp");
// var babel = require("gulp-babel");

// gulp.task("default", function () {
//   return gulp.src("src/**/*.js")// ES6 源码存放的路径
//     .pipe(babel()) 
//     .pipe(gulp.dest("dist")); //转换成 ES5 存放的路径
// });
var gulp = require("gulp");
var sourcemaps = require("gulp-sourcemaps");
var babel = require("gulp-babel");
var concat = require("gulp-concat");
// var watch = require("gulp-watch");

gulp.task("default", function () {
  return gulp.src("src/background/*.js")
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(concat("background.js"))
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest("dist/js"));
});

// gulp.task("watch", function() { // 实时监听
//   gulp.watch('src/*.js', ['babeljs']);
// });
// gulp.task('default', ['watch', 'babeljs']);