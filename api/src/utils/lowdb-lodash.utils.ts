import lodash from "lodash";
import { Low } from "lowdb";

/**
 * Represents a class that extends the Low class with Lodash functionality.
 * @template T - The type of data stored in the LowWithLodash instance.
 */
export default class LowWithLodash<T> extends Low<T> {
  chain: lodash.ExpChain<this["data"]> = lodash.chain(this).get("data");
}
