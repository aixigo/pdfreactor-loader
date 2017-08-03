/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
const http = require( 'http' );

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = function( options ) {
   if( typeof options === 'function' && typeof options.listen === 'function' ) {
      return wrapServer( options );
   }

   const stack = [
      ( req, res ) => {
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
      return server.listen( options.port || 0, options.hostname, callback );
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

   return handle;
};


function wrapServer( server ) {
   const used = [];
   function handle() {
      return server.apply( this, arguments );
   }

   handle.use = function( callback ) {
      used.push( callback );
      server.use( callback );
   };

   handle.unuse = function( callback ) {
      const index = used.indexOf( callback );
      if( index >= 0 ) {
         used.splice( index, 1 );
      }

      server.unuse( callback );
   };

   handle.listen = function( callback ) {
      callback();
   };

   handle.close = function() {
      used.forEach( handle.unuse );
   };

   handle.address = server.address;

   return handle;
}
