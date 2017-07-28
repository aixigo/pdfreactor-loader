/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
const http = require( 'http' );

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = function( options ) {
   const sources = {
   };
   const stack = [
      ( req, res, next ) => {
         if( /^\/[?]/.test( req.url ) && sources.hasOwnProperty( req.url.substr( 2 ) ) ) {
            res.statusCode = 200;
            res.statusMessage = 'Ok';
            res.end( sources[ req.url.substr( 2 ) ] );
            return;
         }
         if( req.url === '/' ) {
            res.statusCode = 200;
            res.statusMessage = 'Ok';
            res.end( `<html><ul>${Object.keys(sources).map(k => {
               return `<li><a href="?${k}">${k}</a></li>`;
            }).join('\n')}</ul></html>` );
            return;
         }

         res.statusCode = 404;
         res.statusMessage = 'Not found';
         res.end( `${res.statusCode} ${res.statusMessage}: ${req.url}` );
      }
   ];

   function handle( req, res ) {
      const callbacks = stack.slice();

      next();

      function next( err ) {
         const callback = callbacks.pop();
         if( callback && !err ) {
            callback( req, res, next );
         }
      }
   }

   const server = http.createServer( handle );

   handle.listen = function( callback ) {
      return server.listen( options.port || 0, options.hostname, callback );
   };

   handle.close = function() {
      return server.close();
   };

   handle.address = function() {
      return server.address();
   };

   handle.use = function( callback ) {
      stack.push( callback );
   };

   handle.unuse = function( callback ) {
      const index = stack.indexOf( callback );
      if( index >= 0 ) {
         stack.splice( index, 1 );
      }
   };

   handle.registerSource = function( resourcePath, source ) {
      sources[ resourcePath ] = source;
   };

   return handle;
};
