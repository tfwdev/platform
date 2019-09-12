import {Mutable, Value} from "../core/react"
import {Graph} from "./graph"
import {inputEdge, inputEdges, outputEdge, property} from "./meta"
import {
  Node,
  NodeConfig,
  NodeTypeRegistry,
  OperatorConfig,
  Operator,
} from "./node"

/** Outputs a constant number. */
abstract class NumberConfig implements NodeConfig {
  type = "number"
  @property() value = 0
  @outputEdge("number") output = undefined
}

class NumberNode extends Node {

  constructor (graph :Graph, id :string, readonly config :NumberConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return Value.constant(this.config.value)
  }
}

/** Outputs a reactive value. */
abstract class ValueConfig implements NodeConfig {
  type = "value"
  @property("Value<number>") value = Value.constant(0)
  @outputEdge("number") output = undefined
}

class ValueNode extends Node {

  constructor (graph :Graph, id :string, readonly config :ValueConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return this.config.value
  }
}

/** Addition operator. */
abstract class AddConfig implements OperatorConfig<number> {
  type = "add"
  @inputEdges("number") inputs = undefined
  @outputEdge("number") output = undefined
}

class Add extends Operator<number> {

  constructor (graph :Graph, id :string, readonly config :AddConfig) {
    super(graph, id, config)
  }

  protected get _defaultInputValue () :number {
    return 0
  }

  protected _apply (values :number[]) :number {
    let sum = 0
    for (const value of values) {
      sum += value
    }
    return sum
  }
}

/** Subtract/negate operator. */
abstract class SubtractConfig implements OperatorConfig<number> {
  type = "subtract"
  @inputEdges("number") inputs = undefined
  @outputEdge("number") output = undefined
}

class Subtract extends Operator<number> {

  constructor (graph :Graph, id :string, readonly config :SubtractConfig) {
    super(graph, id, config)
  }

  protected get _defaultInputValue () :number {
    return 0
  }

  protected _apply (values :number[]) :number {
    if (values.length === 0) {
      return 0
    }
    if (values.length === 1) {
      return -values[0]
    }
    let difference = values[0]
    for (let ii = 1; ii < values.length; ii++) {
      difference -= values[ii]
    }
    return difference
  }
}

/** Multiplication operator. */
abstract class MultiplyConfig implements OperatorConfig<number> {
  type = "multiply"
  @inputEdges("number") inputs = undefined
  @outputEdge("number") output = undefined
}

class Multiply extends Operator<number> {

  constructor (graph :Graph, id :string, readonly config :MultiplyConfig) {
    super(graph, id, config)
  }

  protected get _defaultInputValue () :number {
    return 1
  }

  protected _apply (values :number[]) :number {
    let product = 1
    for (const value of values) {
      product *= value
    }
    return product
  }
}

/** Emits a random number. */
abstract class RandomConfig implements NodeConfig {
  type = "random"
  @property() min = 0
  @property() max = 1
  @outputEdge("number") output = undefined
}

class Random extends Node {

  constructor (graph :Graph, id :string, readonly config :RandomConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return this.graph.clock.fold(
      this._getRandomValue(),
      (value, clock) => this._getRandomValue(),
    )
  }

  protected _getRandomValue () {
    const min = this.config.min === undefined ? 0 : this.config.min
    const max = this.config.max === undefined ? 1 : this.config.max
    return Math.random() * (max - min) + min
  }
}

/** Tracks the sum of its input over time, subject to optional min and max constraints. */
abstract class AccumulateConfig implements NodeConfig {
  type = "accumulate"
  @property() min = -Infinity
  @property() max = Infinity
  @inputEdge("number") input = undefined
  @inputEdge("boolean") reset = undefined
  @outputEdge("number") output = undefined
}

class Accumulate extends Node {
  private _output = Mutable.local(0)

  constructor (graph :Graph, id :string, readonly config :AccumulateConfig) {
    super(graph, id, config)
  }

  connect () {
    this._disposer.add(
      Value
        .join2(
          this.graph.getValue(this.config.reset, false),
          this.graph.getValue(this.config.input, 0),
        )
        .onValue(([reset, input]) => {
          if (reset) this._output.update(0)
          else {
            let sum = this._output.current + input
            if (this.config.min !== undefined) sum = Math.max(this.config.min, sum)
            if (this.config.max !== undefined) sum = Math.min(this.config.max, sum)
            this._output.update(sum)
          }
        })
    )
  }

  protected _createOutput () {
    return this._output
  }
}

/** Outputs the sign of the input (-1, 0, or +1). */
abstract class SignConfig implements NodeConfig {
  type = "sign"
  @property() epsilon = 0.0001
  @inputEdge("number") input = undefined
  @outputEdge("number") output = undefined
}

class Sign extends Node {

  constructor (graph :Graph, id :string, readonly config :SignConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    const epsilon = this.config.epsilon === undefined ? 0.0001 : this.config.epsilon
    return this.graph.getValue(this.config.input, 0).map(
      value => value < -epsilon ? -1 : value > epsilon ? 1 : 0,
    )
  }
}

/** Outputs the absolute value of the input. */
abstract class AbsConfig implements NodeConfig {
  type = "abs"
  @inputEdge("number") input = undefined
  @outputEdge("number") output = undefined
}

class Abs extends Node {

  constructor (graph :Graph, id :string, readonly config :AbsConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return this.graph.getValue(this.config.input, 0).map(Math.abs)
  }
}

/** Outputs the minimum of the inputs. */
abstract class MinConfig implements OperatorConfig<number> {
  type = "min"
  @inputEdges("number") inputs = undefined
  @outputEdge("number") output = undefined
}

class Min extends Operator<number> {

  constructor (graph :Graph, id :string, readonly config :MinConfig) {
    super(graph, id, config)
  }

  protected get _defaultInputValue () :number {
    return 0
  }

  protected _apply (values :number[]) :number {
    return Math.min(...values)
  }
}

/** Outputs the maximum of the inputs. */
abstract class MaxConfig implements OperatorConfig<number> {
  type = "max"
  @inputEdges("number") inputs = undefined
  @outputEdge("number") output = undefined
}

class Max extends Operator<number> {

  constructor (graph :Graph, id :string, readonly config :MaxConfig) {
    super(graph, id, config)
  }

  protected get _defaultInputValue () :number {
    return 0
  }

  protected _apply (values :number[]) :number {
    return Math.max(...values)
  }
}

/** Computes a step function (0 if x < edge, else 1). */
abstract class StepConfig implements NodeConfig {
  type = "step"
  @inputEdge("number") edge = undefined
  @inputEdge("number") x = undefined
  @outputEdge("number") output = undefined
}

class Step extends Node {

  constructor (graph :Graph, id :string, readonly config :StepConfig) {
    super(graph, id, config)
  }

  protected _createOutput () {
    return Value
      .join(
        this.graph.getValue(this.config.edge, 0),
        this.graph.getValue(this.config.x, 0),
      )
      .map(([edge, x]) => x < edge ? 0 : 1)
  }
}

/** Registers the nodes in this module with the supplied registry. */
export function registerMathNodes (registry :NodeTypeRegistry) {
  registry.registerNodeTypes(["math"], {
    number: NumberNode,
    add: Add,
    subtract: Subtract,
    multiply: Multiply,
    random: Random,
    accumulate: Accumulate,
    sign: Sign,
    abs: Abs,
    min: Min,
    max: Max,
    step: Step,
  })
  registry.registerNodeTypes(undefined, {
    value: ValueNode,
  })
}
