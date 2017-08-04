/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
const path = require( 'path' );
const java = require( 'java' );
const http = require( 'http' );
const crypto = require( 'crypto' );
const loaderUtils = require( 'loader-utils' );
const createServer = require( './lib/server' );
const PdfReactorServerPlugin = require( './plugin' );

const BASE64 = 'base64';
const CONFIGURATION = 'com.realobjects.pdfreactor.Configuration';
const KEY_VALUE_PAIR = CONFIGURATION + '$KeyValuePair';
const PDF_REACTOR = 'com.realobjects.pdfreactor.PDFreactor';
const LEVEL = 'java.util.logging.Level';
const LOGGER = 'java.util.logging.Logger';
const LOGGING_HANDLER = 'com.aixigo.pdfreactor_loader.LoggingHandler';
const DEFAULT_LOG_WRITER = 'com.aixigo.pdfreactor_loader.DefaultLogWriter';

const NONCE_HEADER = 'X-PDFreactor-Loader-Nonce';
const LOGGER_ERROR_MESSAGE = ( // eslint-disable-next-line indent
`-----------------------------------------------------------
   pdfreactor-loader: Failed to create and set logger.
   Most probably the reason for this are missing classpath entries for the java classes of this module.
   This can happen, if the jvm was already running before this module was loaded.
   You can fix this manually by adding the entries yourself:

      java.classpath.push( ...require( 'pdfreactor-loader/classpath' ) );
-----------------------------------------------------------`
);

if( !java.isJvmCreated() ) {
   java.registerClient( () => {
      const classpath = require( './classpath' );
      classpath.forEach( cp => {
         java.classpath.push( cp );
      } );
   } );
}

module.exports = function( source ) {
   const options = loaderUtils.getOptions( this ) || {};
   const context = options.context ?
      path.resolve( this.context, options.context ) :
      ( this.options.context || this.context );
   const license = options.license || this.options.license;
   const server = createServer( this.options.server || {} );
   const classpath = Array.isArray( options.classpath ) ? options.classpath : [ options.classpath ];
   const hash = crypto.createHash( 'sha256' );

   hash.update( source );
   hash.update( context );
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
      const loaderNonce = hash.digest( BASE64 );

      const requestHandler = ( req, res, next ) => {
         if( req.headers[ NONCE_HEADER.toLowerCase() ] === loaderNonce ) {
            const resource = path.resolve( context, req.url.substr( 1 ) );
            this.addDependency( resource );
            this.fs.readFile( resource, ( err, content ) => {
               if( err ) {
                  next();
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

      pipe( [
         callback => {
            if( license ) {
               require( 'fs' ).readFile( license, callback );
            }
            else {
               callback( null, null );
            }
         },
         ( licenseKey, callback ) => {
            try {
               pdfConfig.setLoggerSync( provideLogger() );
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
            pdfConfig.setDocumentSync( source.toString() );
            pdfConfig.setRequestHeadersSync(
               java.newInstanceSync( KEY_VALUE_PAIR, NONCE_HEADER, loaderNonce ) );

            if( licenseKey ) {
               pdfConfig.setLicenseKeySync( licenseKey.toString() );
            }

            server.use( requestHandler );
            server.listen( callback );
         },
         callback => {
            const address = server.address();
            pdfConfig.setBaseURLSync( `http://localhost:${address.port}` );
            pdfRenderer.convertAsBinary( pdfConfig, callback );
         },
         ( bytes, callback ) => {
            const buffer = Buffer.from( bytes );
            const entry = {
               name: path.basename( this.resourcePath, path.extname( this.resourcePath ) ),
               time: Date.now(),
               nonce: loaderNonce,
               data: [
                  {
                     type: 'application/pdf',
                     encoding: BASE64,
                     data: buffer.toString( BASE64 )
                  },
                  {
                     type: 'text/html',
                     encoding: BASE64,
                     data: Buffer.from( source ).toString( BASE64 )
                  }
               ]
            };

            postResult( server.address(), entry, err => callback( err, buffer ) );
         }
      ], ( err, buffer ) => {
         this.callback( err, buffer );
         server.close();
      } );
   } );
};

module.exports.plugin = PdfReactorServerPlugin;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

let isLoggerConfigured = false;
function provideLogger() {
   const logger = java.import( LOGGER ).getLoggerSync( 'pdfreactor' );
   if( !isLoggerConfigured ) {
      configureLogger( logger );
      isLoggerConfigured = true;
   }
   return logger;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function configureLogger( logger ) {
   // The parent handler would simply print the log messages to console without proper formatting.
   // Hence we disable it.
   const loggingHandler = java.newInstanceSync( LOGGING_HANDLER );
   const logWriter = java.newInstanceSync( DEFAULT_LOG_WRITER );
   loggingHandler.setLogWriterSync( logWriter );

   logger.setUseParentHandlersSync( false );
   logger.addHandlerSync( loggingHandler );
   logger.setLevelSync( java.import( LEVEL ).FINEST );
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

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function postResult( address, entry, callback ) {
   const req = http.request( {
      method: 'POST',
      port: address.port,
      family: address.family,
      path: '/',
      headers: {
         'content-type': 'application/json'
      }
   }, () => callback( null ) );
   req.on( 'error', callback );
   req.write( JSON.stringify( entry ) );
   req.end();
}
