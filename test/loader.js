/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

'use strict';

const fs = require( 'fs' );
const expect = require( 'chai' ).expect;
const loader = require( '..' );

describe( 'pdfreactor-loader', () => {

   it( 'runs', done => {
      runLoader( {
         query: '?context=' + __dirname + '&classpath=' + __dirname + '/pdfreactor.jar',
         callback( err, source ) {
            if( err ) {
               done( err );
               return;
            }

            expect( source.slice( 0, 5 ).toString() ).to.eql( '%PDF-' );

            done();
         }
      }, __dirname + '/index.html' );
   } ).timeout( 15000 );

   function runLoader( options, request ) {
      const resourcePath = request.split( '!' ).pop();
      const source = fs.readFileSync( resourcePath );

      loader.call( Object.assign( {
         options: { context: __dirname },
         context: __dirname,
         request,
         resourcePath,
         fs,
         cacheable() {},
         async() {}
      }, options ), source, {} );
   }

});
