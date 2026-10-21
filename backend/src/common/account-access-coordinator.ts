import { ConflictException, Injectable } from '@nestjs/common';

/** Serializes cross-document access/assignment decisions in the supported single API process.
 * A database transaction or shared coordinator is required before running multiple API processes.
 */
@Injectable()
export class AccountAccessCoordinator {
  private busy = false;

  async run<T>(action: () => Promise<T>): Promise<T> {
    if (this.busy) {
      throw new ConflictException(
        'Another account or courier assignment is being changed. Please try again.',
      );
    }
    this.busy = true;
    try {
      return await action();
    } finally {
      this.busy = false;
    }
  }
}
