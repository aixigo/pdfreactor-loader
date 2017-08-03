/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */

const JSON_TYPE = /^application\/(.+\+)?json$/;
const ENTRY_PATTERN = /^\/\?(nonce|name)=(.+)&type=(.*)$/;

module.exports = function( /* options */ ) {
   const entries = {};

   return ( req, res, next ) => {
      if( req.url === '/' ) {
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

               entry.data = entry.data.map( d => {
                  return {
                     type: d.type,
                     buffer: Buffer.from( d.data, d.encoding )
                  };
               } );

               if( entry.nonce ) {
                  Object.keys( entries ).forEach( key => {
                     if( entries[ key ].name === entry.name ) {
                        entries[ key ].redirect = entry.nonce;
                        entries[ key ].data = [];
                     }
                  } );
                  entries[ entry.nonce ] = entry;
               }

               res.statusCode = 201;
               res.statusMessage = 'Created';
               res.end();
            } );

            return;
         }

         if( req.method === 'GET' ) {
            res.statusCode = 200;
            res.statusMessage = 'Ok';
            res.end( `<html><dl>${Object.keys( entries ).sort( (k1, k2) => {
               return entries[ k2 ].time - entries[ k1 ].time;
            } ).filter( key => {
               return !(entries[ key ].redirect);
            } ).map( key => {
               const entry = entries[ key ];
               return `<dt>${entry.name}</dt><dd>${entry.data.map( d => {
                  return (
                     `<a href="?nonce=${encodeURIComponent(key)}&type=${encodeURIComponent(d.type)}">` +
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
         const entry = match[ 1 ] === 'nonce' ?
            entries[ query ] :
            { redirect: Object.keys( entries ).filter( nonce => entries[ nonce ][ field ] === query )[ 0 ] };

         const type = decodeURIComponent( match[ 3 ] );
         const redirect = entry ? entry.redirect : null;

         if( req.method === 'GET' && entry ) {
            if( redirect ) {
               res.statusCode = 301;
               res.statusMessage = 'Moved Permanently';
               res.setHeader(
                  'location',
                  `/?nonce=${encodeURIComponent(redirect)}&type=${encodeURIComponent(type)}`
               );
               res.end();
            }
            else {
               const buffer = entry.data.filter( d => d.type === type )[ 0 ].buffer ||
                  ( type === 'application/json' ? JSON.stringify( entry ) : '' );

               res.statusCode = 200;
               res.statusMessage = 'Ok';
               res.setHeader( 'content-type', type );
               res.end( buffer );
            }

            return;
         }
      }
      next();
   };
};
