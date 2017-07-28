/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
const { bold } = require( 'colors/safe' );
const path = require( 'path' );
const createServer = require( './lib/server' );
const loaderPath = require.resolve( __dirname );

module.exports = function( options ) {
   const server = createServer( options || {} );

   function requestHandler( compiler ) {
      const fs = compiler.inputFileSystem;
      const context = compiler.context;

      return ( req, res, next ) => {
         const resource = path.resolve( context, req.url.replace( /^\//, '' ) );
         fs.readFile( resource, ( err, content ) => {
            if( err ) {
               return next();
            }

            res.statusCode = 200;
            res.statusMessage = 'Ok';
            res.end( content );
         } );
      };
   }

   return {
      apply( compiler ) {
         compiler.plugin( 'after-environment', () => {
            server.use( requestHandler( compiler ) );
         } );
         compiler.plugin( 'watch-run', ( watcher, callback ) => {
            server.listen( err => {
               if( !err ) {
                  console.log( `PDFreactor server is running at ${bold( `http://localhost:${server.address().port}/` )}` );
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
         compiler.plugin( 'done', stats => {
         } );
         compiler.plugin( 'failed', stats => {
         } );
         compiler.plugin( 'compilation', compilation => {
            compilation.plugin( 'normal-module-loader', ( loaderContext, module ) => {
               if( module.loaders.some( obj => obj.loader === loaderPath ) ) {
                  loaderContext.server = server;
               }
            } );
         } );
      }
   };
};
