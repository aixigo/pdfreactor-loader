/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

'use strict';

const http = require( 'http' );
const path = require( 'path' );
const java = require( 'java' );
const portfinder = require( 'portfinder' );
const loaderUtils = require( 'loader-utils' );

const CONFIGURATION = 'com.realobjects.pdfreactor.Configuration';
const PDFREACTOR = 'com.realobjects.pdfreactor.PDFreactor';

module.exports = function (source) {
   const options = loaderUtils.getOptions( this ) || {};
   const classpath = Array.isArray( options.classpath ) ? options.classpath : [ options.classpath ];

   this.cacheable();
   this.async();

   if( !java.isJvmCreated() ) {
      java.options.push('-Djava.awt.headless=true');
      java.registerClient( () => {
         classpath.forEach( cp => {
            if( cp ) {
               java.classpath.push( path.resolve( this.context, cp ) );
            }
         } );
      } );
   }

   java.ensureJvm( () => {
      const pdfconfig = java.newInstanceSync( CONFIGURATION );
      const pdfrenderer = java.newInstanceSync( PDFREACTOR );
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

      pdfconfig.setEnableDebugModeSync( true );
      pdfconfig.setAddLinks( true );
      pdfconfig.setAddBookmarks( true );
      pdfconfig.setDocument( source );

      pipe( [
         ( callback ) => {
            listen( server, callback );
         },
         ( port, callback ) => {
            pdfconfig.setBaseURL( 'http://127.0.0.1:' + port );
            pdfrenderer.convertAsBinary( pdfconfig, callback );
         },
         ( bytes, callback ) => {
            callback( null, Buffer.from( bytes ) );
         }
      ], ( err, buffer ) => {
         this.callback( err, buffer );
         server.close();
      } );
   } );
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function listen( server, callback ) {
   let tries = 3;

   repeat();

   function repeat() {
      portfinder.getPort( (err, port) => {
         if (err) {
            callback(err);
         }
         else {
            server.listen( port, err => {
               if (err && tries-- > 0) {
                  setTimeout( repeat, 100 + (Math.random() * 100) );
               }
               else {
                  callback(err, port);
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
};


