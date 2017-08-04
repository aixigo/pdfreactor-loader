/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
package com.aixigo.pdfreactor_loader;

import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.Date;
import java.text.DateFormat;
import java.text.SimpleDateFormat;

public class DefaultLogWriter implements LogWriter {

   private enum Color {
      RESET( "\033[0m" ),
      BOLD( "\033[1m" ),
      RED( "\033[91m" ),
      YELLOW( "\033[93m" ),
      BGBLUE( "\033[44m" );

      private final String code;

      Color( final String c ) {
         code = c;
      }

      public String toString() {
         return code;
      }
   }

   public void writeMessage( LogRecord record ) {
      String message = record.getMessage();
      String time = formatMillis( record.getMillis() );
      String level = formatLevel( record.getLevel() );
      boolean isJsLog = message.startsWith( "JSlog:" );
      boolean isJsError = message.startsWith( "JSerror:" );

      System.out.print(
         "PDF: " +
         time +
         "\t" +
         ( ( isJsLog || isJsError ) ? colorize( Color.BGBLUE, level ) : level ) +
         "\t" +
         message +
         "\n"
      );
   }

   private String formatMillis( long millis ) {
      Date date = new Date( millis );
      DateFormat format = new SimpleDateFormat( "HH:mm:ss.SSS");
      return format.format( date );
   }

   private String formatLevel( Level level ) {
      if( level == Level.SEVERE ) {
         return colorize( Color.RED, level.getName() );
      }
      if( level == Level.WARNING ) {
         return colorize( Color.YELLOW, level.getName() );
      }
      return level.getName();
   }

   private String colorize( Color color, String string ) {
      return "" + color + string + Color.RESET;
   }
}

