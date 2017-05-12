# pdfreactor-loader

> Use [PDFreactor](https://pdfreactor.com) to render HTML to PDF

The _`pdfreactor-loader`_ reads an input HTML document (which is expected to be either a raw string or a URL)
and produces a binary buffer containing the generated PDF document.


## Example

```js
// Render PDF, store it in the file-system and get the URL
import url from 'file-loader!pdfreactor-loader!./index.html';
```


## Java Classpath and Setup

The loader supports a `?classpath` option to add items to the Java classpath. However, since it is not
predictable _when_ the loader will be called the JVM might already be initialized. To alleviate this, it is
recommended to supply any required Java options and classpath items in your webpack configuration, like so:

```js
const java = require( 'java' );
java.options.push( '-Djava.awt.headless=true' );
java.classpath.push( 'target/dependency/pdfreactor.jar' );

module.exports = { /* webpack config here */ };
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

- **Why?**

  Webpack is great for HTML, CSS and JavaScript. _PDFreactor_ is great for producing PDF from those.
  Let's put them together so we can use the tools that we love to quickly build the PDF results that we need.
