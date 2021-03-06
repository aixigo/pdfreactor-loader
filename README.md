# pdfreactor-loader

> Use [PDFreactor](https://pdfreactor.com) to render HTML to PDF

The _`pdfreactor-loader`_ reads an input HTML document (which is expected to be either a raw string or a URL)
and produces a binary buffer containing the generated PDF document.


## Example

```js
// Render PDF, store it in the file-system and get the URL
import url from 'file-loader!pdfreactor-loader!./index.html';
```


## License

If you have a PDFreactor license, you can pass the path of the license file with the `?license` option.
We recommend to store the path of the file in an environment variable and pass that to the loader inside the
webpack configuration:

```js
// webpack.config.js
module.exports = {
   module: {
      rules: [
         {
            test: /\.pdf\.html$/,
            use: 'pdfreactor-loader',
            options: { license: process.env.PDFREACTOR_LICENSE }
         }
      ]
   }
};
```


## Rendering root

By default, additional resources, such as external styles and images, will be resolved relative to the loaded
resources – relative to `./index.html` in the example above. If that does not work for you, you can also pass
the directory as an option to the loader with the `?context` option.
If you pass a relative path to this option, it will be relative to the original context.  When specifying the
option inside the webpack configuration, it is usually a good idea to use an absolute path.

```js
// Render PDF, serve resource from ./pdf-root
import pdfData from 'pdfreactor-loader?context=pdf-root!./index.html';
```


## Built-in HTTP server

To pass additional resources to the PDFreactor process, the loader starts a small HTTP server on the fly.
It serves files straight from webpack's in-memory file system and also takes care of tracking dependency
information and passing it back to the loader.
The loader comes with a plugin that allows you to share the same server instance between multiple loader
invocations. The plugin records loader invocations and comes with a simple web interface to inspect the input
HTML and resulting PDF.

When using the shared server, the default rendering root changes to be root of the server.  By default the
server uses the webpack compilation context directory as root, but this can be changed with the plugin's
`context` option. Note that this does _not_ affect resources where the `context` option is explicitly passed
to the loader.

If you're not happy with the built-in web application, you can replace it by providing the `middleware`
option. This can be either a single connect-/express-style request handler, or an array of multiple such
functions.

```js
// webpack.config.js
const PdfReactorServerPlugin = require( 'pdfreactor-loader/plugin' );

module.exports = {
   context: __dirname,
   plugins: [
      new PdfReactorServerPlugin( {
         // bind to a fixed port instead of a random one
         port: 8099,
         // serve from './pdf-root' instead of the webpack context (__dirname, see above)
         context: path.join( __dirname, 'pdf-root' ),
         // remove the default app
         middleware: []
      } )
   ]
};
```


## Logging

By default, only severe errors are logged. You can use the `log` option to override this.
Use `java.util.logging.Level` keys to specify the desired log level or `false` (disable all logging, even of
fatal PDFreactor errors) or `true` (for the finest log level). If you're using loader options in you import
statement, you can use the `+` and `-` shorthands for boolean values:

```js
import withoutLogging from 'pdfreactor-loader?-log!without-logging.html';
import withLogging from 'pdfreactor-loader?+log!with-logging.html';
```


## Java Classpath and Setup

The loader supports a `?classpath` option to add items to the Java classpath. However, since it is not
predictable _when_ the loader will be called, the JVM might already be initialized. To alleviate this, it is
recommended to supply any required Java options and classpath items in your webpack configuration, like so:

```js
const java = require( 'java' );
java.options.push( '-Djava.awt.headless=true' );
java.classpath.push( 'target/dependency/pdfreactor.jar' );

module.exports = { /* webpack config here */ };
```

If you want to use the logging feature, you should make sure the logger class can be found. There's a
`classpath` file you can import to get the correct classpath entries:

```js
const java = require( 'java' );
java.classpath.push( ...require( 'pdfreactor-loader/classpath' ) );
```


## Q&A:

- **Isn't [PDFreactor](https://pdfreactor.com) commercially licensed?**

  Yes it is! But this module neither directly links to, nor redistributes any _PDFreactor_ artifacts.
  _PDFreactor_ is a nice piece of software, and if you need to generate high quality PDFs from HTML, by all
  means, go check it out!

- **I'm getting an "unmet peer dependency" error for `java`, what up with that?**

  Since it is not possible to have multiple Java VMs in the same process (at least with the `java` node
  module), `pdfreactor-loader` gets out of its way to not interfere with any existing Java dependency.
  To avoid conflicts between multiple modules that need `java`, it is up to you, dear user, to provide the
  `java` module and configure it accordingly.

  As a quick remedy, simply `npm install --add java` or `yarn add java` and set it up as described above.

- **What is `java.lang.NoClassdefFoundError`?**

  You probably need to [set your classpath](#java-classpath-and-setup) correctly. The loader does not bring
  its own `pdfreactor.jar`, so you have to make sure you have a local copy.

- **Webpack just stops while processing the loader!**

  Due to the way the Java binding works, it might happen that it consumes all threads in the UV threadpool
  when waiting for something to be returned by the JavaScript side, especially when webpack loads multiple
  modules with this loader at the same time. Now, if the JavaScript is starting an asynchronous operation
  it will be queued indefinitely because there are no threads left.

  To work around this, you can export `UV_THREADPOOL_SIZE` to be larger than the default size "4".

- **Why?**

  Webpack is great for HTML, CSS and JavaScript. _PDFreactor_ is great for producing PDF from those.
  Let's put them together so we can use the tools that we love to quickly build the PDF results that we need.
