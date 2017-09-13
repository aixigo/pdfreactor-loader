const path = require( 'path' );
const BASE64 = 'base64';

//eslint-disable-next-line consistent-return
module.exports = function( source, map ) {
   if( !(this.options.server && this.options.server.notify) ) {
      return this.callback( null, source, map );
   }

   this.async();

   this.options.server.notify( {
      name: path.basename( this.resourcePath, path.extname( this.resourcePath ) ),
      time: Date.now(),
      data: [
         {
            type: 'application/pdf',
            encoding: BASE64,
            data: Buffer.from( source ).toString( BASE64 )
         }
      ]
   }, err => this.callback( err, source, map ) );
};

module.exports.raw = true;
