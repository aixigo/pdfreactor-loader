/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
const http = require( 'http' );
const path = require( 'path' );
const java = require( 'java' );
const portFinder = require( 'portfinder' );
const loaderUtils = require( 'loader-utils' );
const createLogWriter = require( './lib/log-writer' );

const CONFIGURATION = 'com.realobjects.pdfreactor.Configuration';
const PDF_REACTOR = 'com.realobjects.pdfreactor.PDFreactor';
const LEVEL = 'java.util.logging.Level';
const LOGGER = 'java.util.logging.Logger';
const LOGGING_HANDLER = 'com.aixigo.pdfreactor_loader.LoggingHandler';
const LOG_WRITER = 'com.aixigo.pdfreactor_loader.LogWriter';

if( !java.isJvmCreated() ) {
   java.classpath.push( ...require( './classpath' ) );
}

module.exports = function( source ) {
   const options = loaderUtils.getOptions( this ) || {};
   const classpath = Array.isArray( options.classpath ) ? options.classpath : [ options.classpath ];

   this.cacheable();
   this.async();

   if( !java.isJvmCreated() ) {
      java.options.push('-Djava.awt.headless=true');
      java.registerClient( () => {
         java.classpath.push(
            ...classpath.filter( cp => !!cp ).map( cp => path.resolve( this.context, cp ) )
         );
      } );
   }

   java.ensureJvm( () => {
      const pdfConfig = java.newInstanceSync( CONFIGURATION );
      const pdfRenderer = java.newInstanceSync( PDF_REACTOR );

      const server = http.createServer( ( req, res ) => {
         const resource = path.join( this.context, req.url.substr( 1 ) );
         this.addDependency( resource );
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
      } );

      try {
         pdfConfig.setLoggerSync( createLogger() );
      }
      catch( e ) {
         /* eslint-disable no-console */
         console.warn( `-----------------------------------------------------------
   pdfreactor-loader: Failed to create and set logger.
   Most probably the reason for this are missing classpath entries for the java classes of this module.
   This can happen, if the jvm was already running before this module was loaded.
   You can fix this manually by adding the entries yourself:
   
      java.classpath.push( ...require( 'pdfreactor-loader/classpath' ) );
-----------------------------------------------------------` );
         console.info( '   Underlying Exception:', e );
         /* eslint-enable no-console */
      }
      pdfConfig.setLogLevelSync( java.import( CONFIGURATION ).LogLevel.DEBUG );
      pdfConfig.setEnableDebugModeSync( true );
      pdfConfig.setJavaScriptModeSync( java.import( CONFIGURATION ).JavaScriptMode.ENABLED );
      pdfConfig.setAddLinksSync( true );
      pdfConfig.setAddBookmarksSync( true );
      pdfConfig.setDocumentSync( source );

      pipe( [
         callback => {
            listen( server, callback );
         },
         ( port, callback ) => {
            pdfConfig.setBaseURL( 'http://127.0.0.1:' + port );
            pdfRenderer.convertAsBinary( pdfConfig, callback );
         },
         ( bytes, callback ) => {
            callback( null, Buffer.from( bytes ) );
         }
      ], ( err, buffer ) => {
         this.callback( err, buffer );
         server.close();
      } );
   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createLogger() {
      const logger = java.import( LOGGER ).getLoggerSync( 'pdfreactor' );
      if( logger.getHandlersSync().some( h => java.instanceOf( h, LOGGING_HANDLER ) ) ) {
         // The handler was already created and added in a previous run
         return logger;
      }

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

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function listen( server, callback ) {
   let tries = 3;

   repeat();

   function repeat() {
      portFinder.getPort( ( err, port ) => {
         if( err ) {
            callback(err);
         }
         else {
            server.listen( port, err => {
               if(err && tries-- > 0) {
                  setTimeout( repeat, 100 + (Math.random() * 100) );
               }
               else {
                  callback( err, port );
               }
            } );
         }
      } );
   }
}

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


