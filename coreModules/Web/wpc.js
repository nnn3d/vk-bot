const path = require('path');
const webpack = require('webpack');
const node_dir = path.join(__dirname, '../../node_modules');

console.log(__dirname);
module.exports = {
    entry: {
        // app: path.join(__dirname, "app/index.jsx"), // входная точка - исходный файл
        app: [
            'jquery',
            'popper',
            'bootstrap',
            'bootstrap-style',
            'app',
            'react-widgets-style',
            'react-s-alert-style',
            'react-s-alert-effect',
            'react-slidedown-style',
        ],
    },
    output:{
        path: __dirname,     // путь к каталогу выходных файлов - папка public
        filename: "bundle.js" ,      // название создаваемого файла
    },
    debug: true,
    noInfo: false,
    resolve:{
        extensions: ["", ".js", ".jsx", ".css"], // расширения для загрузки модулей
        root: __dirname,
        alias: {
            'jquery': node_dir + '/jquery/dist/jquery.js',
            'popper': node_dir + '/popper.js/dist/umd/popper.min.js',
            'bootstrap': node_dir + '/bootstrap/dist/js/bootstrap.min.js',
            'bootstrap-style': node_dir + '/bootstrap/dist/css/bootstrap.min.css',
            'react-widgets-style': node_dir + '/react-widgets/dist/css/react-widgets.css',
            'react-s-alert-style': node_dir + '/react-s-alert/dist/s-alert-default.css',
            'react-s-alert-effect': node_dir + '/react-s-alert/dist/s-alert-css-effects/stackslide.css',
            'react-slidedown-style': node_dir + '/react-slidedown/lib/slidedown.css',
            'app': path.join(__dirname, "app/index.jsx"),
            'components': path.join(__dirname, "app/components/"),
        },
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                BROWSER:  JSON.stringify(true),
                NODE_ENV: JSON.stringify('production'),
            }
        }),
        new webpack.ProvidePlugin({
            $: "jquery",
            jquery: "jquery",
            "window.jQuery": "jquery",
            jQuery:"jquery",
            Popper: 'popper',
        })
    ],
    module:{
        loaders:[   //загрузчики
            {
                test: /\.jsx?$/, // определяем тип файлов
                exclude: /(node_modules)/,
                loader: ["babel-loader"],
                query: {
                    // presets: ["env", "react"],
                    presets:["es2015", "react"],
                    cacheDirectory: path.join(__dirname, 'tmp/'),
                },
            },
            // {
            //     test: /\.jsx?$/, // определяем тип файлов
            //     exclude: /(node_modules)/,
            //     loader: ["react-hot-loader/webpack"],
            // },
            {
                test: /\.css(\?.*)?$/,
                loader: 'style-loader!css-loader',
            },
            {
                test: /\.(ttf|eot|woff|woff2|jpe?g|png|bmp|svg|gif)(\?.*)?$/i,
                loader: 'url-loader',
            },
        ]
    }
};