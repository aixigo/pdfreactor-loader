const { bgBlue, bold, red } = require('colors/safe');

const JS_LOG_PREFIX_MATCHER = /^(JSlog:)/;
const JS_ERROR_PREFIX_MATCHER = /^(JSerror:)/;

module.exports = function() {

   let messageQueue = Promise.resolve();

   return {
      writeMessage( logRecord ) {
         // We're logging asynchronously (but in order) to prevent from errors during logging messing up
         // the rendering process
         messageQueue = messageQueue.then( () => {
            const record = {
               level: logRecord.getLevelSync().getNameSync(),
               message: logRecord.getMessageSync(),
               time: new Date( logRecord.getMillisSync() ),
               parameters: logRecord.getParametersSync(),
               sequenceNumber: logRecord.getSequenceNumberSync(),
               sourceClassName: logRecord.getSourceClassNameSync(),
               sourceMethodName: logRecord.getSourceMethodNameSync(),
               threadId: logRecord.getThreadIDSync(),
               thrown: logRecord.getThrownSync(),
               isJsLog: isJsLog( logRecord.getMessageSync() )
            };
            // eslint-disable-next-line no-console
            console.log( `PDF: ${_time( record )}\t${_level( record )}\t${_message( record )}` );
         } );
      }
   };

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function _message( { message } ) {
      const [ logPrefix ] = JS_LOG_PREFIX_MATCHER.exec( message ) || [];
      if( logPrefix ) {
         return message.replace( logPrefix, bold( logPrefix.toUpperCase() ) );
      }
      const [ errorPrefix ] = JS_ERROR_PREFIX_MATCHER.exec( message ) || [];
      if( errorPrefix ) {
         return message.replace( errorPrefix, red( errorPrefix ) );
      }
      return message;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function _level( { level, isJsLog } ) {
      const formattedLevel = [ 'WARNING', 'SEVERE' ].includes( level ) ? red( level ) : level;
      return isJsLog ? bgBlue( formattedLevel ) : formattedLevel;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function _time( { time } ) {
      return time.toISOString().split( 'T' )[ 1 ].replace( /[^0-9:.]/g, '' );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function isJsLog( message ) {
      return !!( JS_LOG_PREFIX_MATCHER.exec( message ) || JS_ERROR_PREFIX_MATCHER.exec( message ) );
   }

};
