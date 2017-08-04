/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
const { bold } = require( 'colors/safe' );
const path = require( 'path' );
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

         compiler.plugin( 'after-environment', () => {
            middleware.unshift( requestHandler( compiler.inputFileSystem, context ) );
            middleware.forEach( server.use );
         } );
         compiler.plugin( 'watch-run', ( watcher, callback ) => {
            server.listen( err => {
               const baseUrl = `http://localhost:${server.address().port}/`;
               if( !err ) {
                  // eslint-disable-next-line no-console
                  console.log( `PDFreactor server is running at ${bold( baseUrl )}` );
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
               if( module.loaders.some( obj => obj.loader === loaderPath ) ) {
                  loaderContext.options = Object.assign(
                     loaderContext.options || {},
                     options,
                     { server, context }
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
