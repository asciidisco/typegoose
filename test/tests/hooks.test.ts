import { logger } from '../../src/logSettings';
import { pre, prop } from '../../src/typegoose';
import { ExtendedHookModel, Hook, HookArray, HookArrayModel, HookModel } from '../models/hook1';
import { Hook2Model } from '../models/hook2';

it('RegEXP tests', async () => {
  const doc = new HookModel({ material: 'iron' } as Hook);
  await doc.save();
  await doc.updateOne(doc).exec(); // to run the update hook with regexp, find doesn't work (it doesn't get applied)

  const found = await HookModel.findById(doc.id).exec();
  expect(typeof found).not.toBe('undefined');
  expect(found).toHaveProperty('material', 'REGEXP_POST');
  expect(found).toHaveProperty('shape', 'REGEXP_PRE');
});

it('should update the property using isModified during pre save hook', async () => {
  const hook = await HookModel.create({
    material: 'steel',
  });
  expect(hook).toHaveProperty('shape', 'oldShape');

  hook.set('shape', 'changed');
  const savedHook = await hook.save();
  expect(savedHook).toHaveProperty('shape', 'newShape');
});

it('should test findOne post hook', async () => {
  await Hook2Model.create({ text: 'initial' });

  // text is changed in pre save hook
  const dummyFromDb = await Hook2Model.findOne({ text: 'saved' }).exec();
  expect(dummyFromDb).toHaveProperty('text', 'changed in post findOne hook');
});

it('should find the unexpected dummies because of pre and post hooks', async () => {
  await Hook2Model.create([{ text: 'whatever' }, { text: 'whatever' }]);

  const foundDummies = await Hook2Model.find({ text: 'saved' }).exec();

  // pre-save-hook changed text to saved
  expect(foundDummies.length > 2).toBe(true);
  expect(foundDummies[0]).toHaveProperty('text', 'changed in post find hook');
  expect(foundDummies[1]).toHaveProperty('text', 'saved');
});

it('should test the updateMany hook', async () => {
  await Hook2Model.insertMany([{ text: 'foobar42' }, { text: 'foobar42' }]);

  await Hook2Model.updateMany({ text: 'foobar42' }, { text: 'lorem ipsum' }).exec();

  const foundUpdatedDummies = await Hook2Model.find({ text: 'updateManied' }).exec();

  // pre-updateMany-hook changed text to 'updateManied'
  expect(foundUpdatedDummies).toHaveLength(2);
});

it('should execute multiple hooks with array', async () => {
  const doc = await HookArrayModel.create({} as HookArray);
  await HookArrayModel.find({}).exec();
  await HookArrayModel.findOne({ _id: doc.id }).exec();

  const found = await HookArrayModel.findById(doc.id).orFail().exec();
  expect(typeof found).not.toBe('undefined');
  expect(Array.isArray(found.testArray)).toBe(true);
  expect(found.testArray).toHaveLength(3);
  expect(Array.from(found.testArray)).toEqual(['hello', 'hello', 'hello']);
});

it('should execute pre hooks only twice in case inheritance is being used [typegoose#218]', async () => {
  const doc = new ExtendedHookModel();
  await doc.save();
  expect(doc.hooksMessages.length).toEqual(2);
});

it('should execute post hooks only twice in case inheritance is being used [typegoose#218]', async () => {
  const doc = new ExtendedHookModel();
  await doc.save();

  const docFromDb = await ExtendedHookModel.findOne({ _id: doc._id }).orFail().exec();
  expect(docFromDb.hooksMessages.length).toEqual(4);
});

it('should throw a Error when a hooks second parameter is not a function', async () => {
  try {
    // @ts-expect-error The second argument should be a function (test a warning)
    @pre<TestHookFunctionNotFunction>('save', 'string')
    class TestHookFunctionNotFunction {
      @prop()
      public dummy?: string;
    }

    fail('Expected this to fail');
  } catch (err) {
    expect(err).toBeInstanceOf(TypeError);
    expect(err.message).toMatchSnapshot();
  }
});

it('should log a warning if "addToHooks" parameter "args" is longer than 2', async () => {
  const loggerSpy = jest.spyOn(logger, 'warn').mockImplementationOnce(() => void 0);

  const customPre = jest.fn(() => fail('Expected this function to not be executed'));

  // @ts-expect-error a third argument is not allowed, but will be tested for the warning
  @pre<TestAddToHooksArgsLengthWarning>('save', customPre, 'somethingElse')
  class TestAddToHooksArgsLengthWarning {
    @prop()
    public dummy?: string;
  }

  expect(loggerSpy).toHaveBeenCalledTimes(1);
  expect(loggerSpy.mock.calls).toMatchSnapshot();
});
