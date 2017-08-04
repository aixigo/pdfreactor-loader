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

   private static String JSLOG_PREFIX = "JSlog:";
   private static String JSERROR_PREFIX = "JSerror:";

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
      String rawMessage = record.getMessage();
      String time = formatMillis( record.getMillis() );
      String level = formatLevel( record.getLevel() );
      String message = formatMessage( rawMessage );

      boolean isJsLog = rawMessage.startsWith( JSLOG_PREFIX );
      boolean isJsError = rawMessage.startsWith( JSERROR_PREFIX );

      if( isJsLog || isJsError ) {
         level = colorize( Color.BGBLUE, level );
      }

      System.out.print( "PDF: " + time + "\t" + level + "\t" + message + "\n" );
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

   private String formatMessage( String message ) {
      if( message.startsWith( JSLOG_PREFIX ) ) {
         return colorize( Color.BOLD, JSLOG_PREFIX.toUpperCase() ) +
            message.substring( JSLOG_PREFIX.length() );
      }
      if( message.startsWith( JSERROR_PREFIX ) ) {
         return colorize( Color.RED, JSERROR_PREFIX.toUpperCase() ) +
            message.substring( JSERROR_PREFIX.length() );
      }
      return message;
   }

   private String colorize( Color color, String string ) {
      return "" + color + string + Color.RESET;
   }
}

