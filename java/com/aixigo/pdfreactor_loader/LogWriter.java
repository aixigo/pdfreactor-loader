/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * https://opensource.org/licenses/MIT
 */
package com.aixigo.pdfreactor_loader;

import java.util.logging.LogRecord;

public interface LogWriter {

   public void writeMessage( LogRecord record );

}
