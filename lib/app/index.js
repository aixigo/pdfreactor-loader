/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

const JSON_TYPE = /^application\/(.+\+)?json$/;
const ENTRY_PATTERN = /^\/\?(name)=(.+)&type=(.*)$/;

module.exports = function( options ) {
   const entries = {};
   const api = options.api || '/';

   return ( req, res, next ) => {
      if( req.url === api ) {
         if( req.method === 'POST' && JSON_TYPE.test( req.headers[ 'content-type' ] ) ) {
            const buffers = [];
            req.on( 'data', data => {
               buffers.push( data );
            } );
            req.on( 'end', data => {
               if( data ) {
                  buffers.push( data );
               }
               const entry = JSON.parse( Buffer.concat( buffers ) );
               const types = {};

               entry.data = entry.data.map( d => {
                  types[ d.type ] = true;

                  return {
                     type: d.type,
                     buffer: Buffer.from( d.data, d.encoding )
                  };
               } );

               if( entry.name ) {
                  if( entries[ entry.name ] ) {
                     entries[ entry.name ].data.filter( d => {
                        return !types[ d.type ];
                     } ).forEach( d => {
                        types[ d.type ] = true;
                        entry.data.push( d );
                     } );
                  }

                  entries[ entry.name ] = entry;
               }

               res.statusCode = 201;
               res.statusMessage = 'Created';
               res.end();
            } );

            return;
         }
      }

      if( req.url === '/' ) {
         if( req.method === 'GET' ) {
            res.statusCode = 200;
            res.statusMessage = 'Ok';
            res.end( `<html><dl>${Object.keys( entries ).sort( (k1, k2) => {
               return entries[ k2 ].time - entries[ k1 ].time;
            } ).map( key => {
               const entry = entries[ key ];
               return `<dt>${entry.name}</dt><dd>${entry.data.map( d => {
                  return (
                     `<a href="?name=${encodeURIComponent(entry.name)}&type=${encodeURIComponent(d.type)}">` +
                     d.type +
                     '</a>'
                  );
               } ).join(', ')} (${new Date(entry.time).toISOString()})</dd>`;
            } ).join( '\n' )}</dl></html>` );
            return;
         }
      }

      const match = ENTRY_PATTERN.exec( req.url );
      if( match ) {
         const field = decodeURIComponent( match[ 1 ] );
         const query = decodeURIComponent( match[ 2 ] );
         const type = decodeURIComponent( match[ 3 ] );

         const key = Object.keys( entries ).find( key => entries[ key ][ field ] === query );

         if( req.method === 'GET' && key ) {
            const entry = entries[ key ];
            const data = entry.data.find( d => d.type === type ) || {};
            const buffer = data.buffer ||
               ( type === 'application/json' ? JSON.stringify( entry ) : '' );

            res.statusCode = 200;
            res.statusMessage = 'Ok';
            res.setHeader( 'content-type', type );
            res.end( buffer );

            return;
         }
      }
      next();
   };
};
