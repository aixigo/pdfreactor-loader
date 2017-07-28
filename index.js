/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
const path = require( 'path' );
const java = require( 'java' );
const crypto = require( 'crypto' );
const loaderUtils = require( 'loader-utils' );
const createLogWriter = require( './lib/log-writer' );
const createServer = require( './lib/server' );
const PdfReactorServerPlugin = require( './plugin' );

const CONFIGURATION = 'com.realobjects.pdfreactor.Configuration';
const KEY_VALUE_PAIR = CONFIGURATION + '$KeyValuePair';
const PDF_REACTOR = 'com.realobjects.pdfreactor.PDFreactor';
const LEVEL = 'java.util.logging.Level';
const LOGGER = 'java.util.logging.Logger';
const LOGGING_HANDLER = 'com.aixigo.pdfreactor_loader.LoggingHandler';
const LOG_WRITER = 'com.aixigo.pdfreactor_loader.LogWriter';

const NONCE_HEADER = 'X-PDFreactor-Loader-Nonce';
const LOGGER_ERROR_MESSAGE = (
`-----------------------------------------------------------
   pdfreactor-loader: Failed to create and set logger.
   Most probably the reason for this are missing classpath entries for the java classes of this module.
   This can happen, if the jvm was already running before this module was loaded.
   You can fix this manually by adding the entries yourself:

      java.classpath.push( ...require( 'pdfreactor-loader/classpath' ) );
-----------------------------------------------------------`
);

if( !java.isJvmCreated() ) {
   java.classpath.push( ...require( './classpath' ) );
}

module.exports = function( source ) {
   const options = loaderUtils.getOptions( this ) || {};
   const classpath = Array.isArray( options.classpath ) ? options.classpath : [ options.classpath ];
   const hash = crypto.createHash( 'sha256' );

   hash.update( this.request );

   this.cacheable();
   this.async();

   if( !java.isJvmCreated() ) {
      java.options.push('-Djava.awt.headless=true');
      java.registerClient( () => {
         classpath.forEach( cp => {
            if( cp ) {
               java.classpath.push( cp );
            }
         } );
      } );
   }

   java.ensureJvm( () => {
      const pdfConfig = java.newInstanceSync( CONFIGURATION );
      const pdfRenderer = java.newInstanceSync( PDF_REACTOR );
      const loaderNonce = hash.digest( 'base64' );

      const requestHandler = ( req, res, next ) => {
         // TODO: url -?-> resource
         if( req.headers[ NONCE_HEADER.toLowerCase() ] === loaderNonce ) {
            const resource = path.resolve( this.context, '..', req.url.substr( 1 ) );
            this.addDependency( resource );
         }
         next();
      };
      const fileSystemServer = ( req, res, next ) => {
         if( req.headers[ NONCE_HEADER.toLowerCase() ] === loaderNonce ) {
            const resource = path.resolve( this.context, req.url.substr( 1 ) );

            this.fs.readFile( resource, ( err, content ) => {
               if( err ) {
                  res.statusCode = 404;
                  res.statusMessage = 'Not found';
                  res.end( err.message );
                  return;
               }

               res.statusCode = 200;
               res.statusMessage = 'Ok';
               res.end( content );
            } );
         }
         else {
            next();
         }
      };

      const server = this.server || createServer( {} );

      pipe( [
         callback => {
            try {
               //pdfConfig.setLoggerSync( createLogger() );
            }
            catch( e ) {
               /* eslint-disable no-console */
               console.warn( LOGGER_ERROR_MESSAGE );
               console.info( '   Underlying Exception:', e );
               /* eslint-enable no-console */
            }
            pdfConfig.setLogLevelSync( java.import( CONFIGURATION ).LogLevel.DEBUG );
            pdfConfig.setEnableDebugModeSync( true );
            pdfConfig.setJavaScriptModeSync( java.import( CONFIGURATION ).JavaScriptMode.ENABLED );
            pdfConfig.setAddLinksSync( true );
            pdfConfig.setAddBookmarksSync( true );
            pdfConfig.setDocumentSync( source );
            pdfConfig.setRequestHeadersSync(
               java.newInstanceSync( KEY_VALUE_PAIR, NONCE_HEADER, loaderNonce ) );
            callback();
         },
         callback => {
            server.use( requestHandler );
            if( server !== this.server ) {
               server.use( fileSystemServer );
               server.listen( callback );
            }
            else {
               callback();
            }
         },
         callback => {
            const address = server.address();
            pdfConfig.setBaseURLSync( `http://localhost:${address.port}` );
            pdfRenderer.convertAsBinary( pdfConfig, callback );
         },
         ( bytes, callback ) => {
            callback( null, Buffer.from( bytes ) );
         }
      ], ( err, buffer ) => {
         this.callback( err, buffer );
         server.unuse( requestHandler );

         if( server !== this.server ) {
            server.close();
         }
         else {
            const name = path.basename( this.resourcePath, path.extname( this.resourcePath ) );
            server.registerSource( name + '.html', source );
            server.registerSource( name + '.pdf', buffer );
         }
      } );
   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createLogger() {
      const logger = java.import( LOGGER ).getLoggerSync( 'pdfreactor' );
      //if( logger.getHandlersSync().some( h => java.instanceOf( h, LOGGING_HANDLER ) ) ) {
         // The handler was already created and added in a previous run
         return logger;
      //}

      // The parent handler would simply print the log messages to console without proper formatting.
      // Hence we disable it.
      const loggingHandler = java.newInstanceSync( LOGGING_HANDLER );
      const logWriter = java.newProxy( LOG_WRITER, createLogWriter() );
      loggingHandler.setLogWriterSync( logWriter );

      logger.setUseParentHandlers( false );
      logger.addHandlerSync( loggingHandler );
      logger.setLevelSync( java.import( LEVEL ).FINEST );
      return logger;
   }
};

module.exports.plugin = PdfReactorServerPlugin;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function pipe( fns, callback ) {
   const stack = fns.slice();

   iterate( null );

   function iterate( err ) {
      const fn = stack.shift();

      if( err || !fn ) {
         callback.apply( null, arguments );
      }
      else {
         fn.apply( null, Array.prototype.slice.call( arguments, 1, fn.length ).concat( [ iterate ] ) );
      }
   }
}


