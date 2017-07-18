package com.aixigo.pdfreactor_loader;

import java.util.logging.Handler;
import java.util.logging.LogRecord;

public class LoggingHandler extends Handler {

   private LogWriter writer = null;

   public LoggingHandler() {
      super();
   }

   public void setLogWriter( LogWriter writer ) {
      this.writer = writer;
   }

   public void close() {
      // noop
   }

   public void flush() {
      // noop
   }

   public void publish( LogRecord record ) {
      if( writer == null ) {
         return;
      }
      writer.writeMessage( record );
   }

}
