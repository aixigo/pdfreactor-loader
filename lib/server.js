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

   handle.listen = callback => server.listen( options.port || 0, options.hostname, callback );

   handle.close = () => server.close();

   handle.address = () => server.address();

   handle.use = callback => stack.push( callback );

   handle.unuse = callback => {
      const index = stack.indexOf( callback );
      if( index >= 0 ) {
         stack.splice( index, 1 );
      }
   };

   handle.notify = ( data, callback ) => callback();

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

   handle.unuse = callback => {
      const index = used.indexOf( callback );
      if( index >= 0 ) {
         used.splice( index, 1 );
      }

      server.unuse( callback );
   };

   handle.listen = callback => callback();

   handle.close = () => { used.forEach( handle.unuse ); };

   handle.address = server.address;
   handle.notify = server.notify;

   return handle;
}
