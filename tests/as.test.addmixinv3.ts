import { assert } from "chai";
import * as as from "../src/as.js";
import type { PropSpecs, PropAccessor, PropRW } from "../src/as.js";

interface Person {
  username: string;
  password: string;
  title: string;
  employeeId: string;
  loginCount: number;
  toString: string;
}

interface Useree {
  checkPassword: (pwd: string) => boolean;
}

interface Employee {
  employeeId: PropAccessor<string>;
  title: PropRW<string, Employee>;
}

describe("addMixinV3 - Example and Test", function () {
  it("tells a story: a person gains two mixin behaviors — useree and employee — that share state, stay pure behavior, and resist misuse", function () {
    const person: Person = {
      username: "alice",
      password: "s3cret",
      title: "Engineer",
      employeeId: "E-042",
      loginCount: 0,
      // A data field that happens to collide with Object.prototype's `toString` name — a stress
      // test for fix #1: a mixin's own inherited toString must never shadow real person state.
      toString: "friendly",
    };

    // "useree" follows the createXxxee/asXxxee convention: a private `my`, a public `yours`, wired by mineAsYours.
    function createUseree(model: Person): Useree {
      model.loginCount += 1; // counts how many times the mixin creator actually ran
      const my: Useree = { checkPassword: (pwd) => pwd === model.password };
      const yours = {} as Useree;
      as.mineAsYours(["checkPassword"], my, yours);
      return yours;
    }
    const asUseree = (model: Person) =>
      as.addMixinV3("useree", createUseree, model);

    // "employee" instead builds its accessors from a propSpec via asProps.
    const employeePropSpecs: PropSpecs<Person> = {
      employeeId: "r",
      title: "rw",
    };
    function createEmployee(model: Person): Employee {
      interface EmployeePrivate extends Employee {
        isManagement: () => boolean;
      }

      const my = as.asProps<Person, EmployeePrivate>(
        {} as EmployeePrivate,
        employeePropSpecs,
        model,
      );
      my.isManagement = () => model.title === "Manager"; // private helper, kept off the mineAsYours key list below
      const yours = {} as Employee;
      as.mineAsYours(Object.keys(employeePropSpecs), my, yours);
      return yours;
    }
    const asEmployee = (model: Person) =>
      as.addMixinV3("employee", createEmployee, model);

    // Wrapping the person in "useree" adds behavior without touching the person itself.
    const useree = asUseree(person);
    assert.isTrue(useree.checkPassword("s3cret"));
    assert.isFalse(useree.checkPassword("wrong"));

    // `in` finds mixin behavior, the same way it would find a class's own prototype methods.
    assert.isTrue("checkPassword" in useree);
    assert.isFalse("checkTwoFactor" in useree);

    // Behavior stays non-enumerable: only the person's own state shows up in keys/serialization.
    assert.deepEqual(Object.keys(useree), [
      "username",
      "password",
      "title",
      "employeeId",
      "loginCount",
      "toString",
    ]);
    assert.equal(JSON.stringify(useree), JSON.stringify(person));

    // The person's own state wins over the mixin's inherited (and irrelevant) Object.prototype.toString.
    assert.equal(useree.toString, "friendly");

    // Reassigning mixin-owned behavior is refused rather than silently accepted and ignored.
    assert.throws(() => {
      // Deliberately bypass typing to exercise the runtime set-trap guard (fix #4) directly —
      // a plain-JS caller without static types could still attempt this.
      (useree as unknown as Record<string, unknown>).checkPassword = () => true;
    }, /mixin-provided property/);

    // Genuine state writes still pass straight through to the underlying person.
    useree.username = "alice2";
    assert.equal(person.username, "alice2");

    // Calling the same mixin twice on the bare person is a harmless no-op: cached, not rebuilt.
    const useree2 = asUseree(person);
    assert.equal(useree, useree2);
    assert.equal(person.loginCount, 1);

    // But feeding the mixin's own output back into itself is almost certainly a bug, so it throws.
    assert.throws(() => asUseree(useree), /already been applied/);

    // A second, different mixin — built from a propSpec this time — can still be layered onto the
    // very same person, sharing its state: no name collisions between the two behaviors.
    const employee = asEmployee(person);
    assert.equal(employee.employeeId(), "E-042");
    assert.equal(employee.title(), "Engineer");

    // The read-write prop can be changed through the mixin, and it's really writing to the person —
    // visible through *both* mixins, since they're just different behavioral lenses on one object.
    employee.title("Staff Engineer");
    assert.equal(person.title, "Staff Engineer");
    assert.isTrue(useree.checkPassword("s3cret")); // useree still works fine after employee was added

    // Private mixin helpers stay private: isManagement lived on `my`, never copied onto `yours`.
    assert.isUndefined(
      (employee as unknown as Record<string, unknown>).isManagement,
    );

    // mineAsYours' fluent-chaining trick resolves to a usable object, so calls can still chain naturally
    // (it's the raw `yours` object built inside createEmployee, not the outer proxy `employee` itself —
    // those are two different objects, since the proxy wraps `person`, not `yours`).
    assert.equal(employee.title("Lead Engineer").title(), "Lead Engineer");

    // Same set-trap rule as useree: title is now a mixin-owned key, so overwriting it throws.
    assert.throws(() => {
      // Same reasoning as the checkPassword bypass above.
      (employee as unknown as Record<string, unknown>).title = "CEO";
    }, /mixin-provided property/);
  });
});
