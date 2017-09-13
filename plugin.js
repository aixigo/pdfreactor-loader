/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
const path = require( 'path' );
const http = require( 'http' );
const createServer = require( './lib/server' );
const createApp = require( './lib/app' );
const loaderPath = require.resolve( __dirname );

module.exports = function( options ) {
   const server = createServer( options || {} );

   return {
      apply( compiler ) {
         const context = ( options && options.context ) || compiler.context;
         const middleware = [];

         if( Array.isArray( options.middleware ) ) {
            middleware.push.apply( middleware, options.middleware );
         }
         else if( 'middleware' in options ) {
            middleware.push( options.middleware );
         }
         else {
            middleware.push( createApp( options ) );
         }

         server.notify = ( entry, callback ) => {
            const address = server.address();
            const req = http.request( {
               method: 'POST',
               port: address.port,
               family: address.family,
               path: options.api || '/',
               headers: {
                  'content-type': 'application/json'
               }
            }, () => callback( null ) );

            req.on( 'error', callback );
            req.write( JSON.stringify( entry ) );
            req.end();
         };

         compiler.plugin( 'after-environment', () => {
            middleware.unshift( requestHandler( compiler.inputFileSystem, context ) );
            middleware.forEach( server.use );
         } );
         compiler.plugin( 'watch-run', ( watcher, callback ) => {
            server.listen( err => {
               const baseUrl = `http://localhost:${server.address().port}/`;
               if( !err ) {
                  // eslint-disable-next-line no-console
                  console.log( `PDFreactor server is running at \u001b[1m${baseUrl}\u001b[0m` );
               }
               callback( err );
            } );
         } );
         compiler.plugin( 'watch-close', ( watcher, callback ) => {
            server.close();
            callback();
         } );
         compiler.plugin( 'before-run', ( compiler, callback ) => {
            server.listen( callback );
         } );
         compiler.plugin( 'compilation', compilation => {
            compilation.plugin( 'normal-module-loader', ( loaderContext, module ) => {
               const index = module.loaders.findIndex( obj => obj.loader === loaderPath );
               if( index >= 0 ) {
                  loaderContext.options = Object.assign(
                     loaderContext.options || {},
                     options,
                     { server, context }
                  );

                  module.loaders.splice(
                     index,
                     1,
                     { loader: require.resolve( './lib/post' ) },
                     module.loaders[ index ],
                     { loader: require.resolve( './lib/pre' ) }
                  );
               }
            } );
         } );
      }
   };
};

function requestHandler( fs, context ) {
   return ( req, res, next ) => {
      const resource = path.resolve( context, req.url.replace( /^\//, '' ) );
      fs.readFile( resource, ( err, content ) => {
         if( err ) {
            next();
            return;
         }

         res.statusCode = 200;
         res.statusMessage = 'Ok';
         res.end( content );
      } );
   };
}
