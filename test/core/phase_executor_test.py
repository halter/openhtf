# Copyright 2022 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Unit tests for phase_executor module."""

import sys
import unittest

import openhtf
from openhtf.core import phase_descriptor
from openhtf.core import phase_executor
from openhtf.core import test_record
from openhtf.util import test as htf_test

class PhaseExecutorTest(unittest.TestCase):

  def _run_repeating_phase(self, phase_options, expected_call_count):
    call_count = 0

    @phase_options
    def repeating_phase():
      nonlocal call_count
      call_count += 1
      if call_count < phase_descriptor.DEFAULT_REPEAT_LIMIT + 1:
        return phase_descriptor.PhaseResult.REPEAT
      return phase_descriptor.PhaseResult.STOP

    test = openhtf.Test(repeating_phase)
    test.execute()
    self.assertEqual(call_count, expected_call_count)

  def test_execute_phase_with_repeat_limit_unspecified_uses_default_limit(self):
    self._run_repeating_phase(
        openhtf.PhaseOptions(),
        expected_call_count=phase_descriptor.DEFAULT_REPEAT_LIMIT,
    )

  def test_execute_phase_with_repeat_limit_none_uses_default_limit(self):
    self._run_repeating_phase(
        openhtf.PhaseOptions(repeat_limit=None),
        expected_call_count=phase_descriptor.DEFAULT_REPEAT_LIMIT,
    )

  def test_execute_phase_with_repeat_limit_max_exceeds_default_limit(self):
    self._run_repeating_phase(
        openhtf.PhaseOptions(repeat_limit=phase_descriptor.MAX_REPEAT_LIMIT),
        expected_call_count=phase_descriptor.DEFAULT_REPEAT_LIMIT + 1,
    )


class PhaseExecuterRunIfTest(htf_test.TestCase):

  def test_execute_phase_when_run_if_throws_exception(self):

    def run_if_with_exception():
      raise Exception("run_if_with_exception")

    def phase_excp_run_if():
      pass

    phase = openhtf.PhaseOptions(run_if=run_if_with_exception)(
                                 phase_excp_run_if)
    record = self.execute_phase_or_test(openhtf.Test(phase))
    self.assertTestError(record)


class ExceptionInfoTest(unittest.TestCase):
  """Tests for ExceptionInfo class."""

  def test_as_base_types_regular_exception(self):
    """ExceptionInfo does NOT include operator_popup for regular exceptions."""
    try:
      raise ValueError("Regular error")
    except ValueError:
      info = phase_executor.ExceptionInfo(*sys.exc_info())

    result = info.as_base_types()
    self.assertIn('exc_type', result)
    self.assertIn('exc_val', result)
    self.assertIn('exc_tb', result)
    self.assertNotIn('operator_popup', result)

  def test_as_base_types_with_recovery_prompt_error(self):
    """ExceptionInfo includes operator_popup for RecoveryPromptError."""
    # Create a mock error with the required attributes
    class MockRecoveryPromptError(Exception):
      def __init__(self):
        self.title = {"en": "Test Error", "th": "ข้อผิดพลาด"}
        self.description = {"en": "Check connection", "th": "ตรวจสอบการเชื่อมต่อ"}
        self.image_url = "/img/help.png"
        super().__init__(self.title.get("en", "Error"))

    try:
      raise MockRecoveryPromptError()
    except MockRecoveryPromptError:
      info = phase_executor.ExceptionInfo(*sys.exc_info())

    result = info.as_base_types()
    self.assertIn('operator_popup', result)
    self.assertEqual(result['operator_popup']['title'], {"en": "Test Error", "th": "ข้อผิดพลาด"})
    self.assertEqual(result['operator_popup']['description'], {"en": "Check connection", "th": "ตรวจสอบการเชื่อมต่อ"})
    self.assertEqual(result['operator_popup']['image_url'], "/img/help.png")

  def test_as_base_types_recovery_prompt_error_without_image(self):
    """ExceptionInfo handles RecoveryPromptError without image_url."""
    class MockRecoveryPromptErrorNoImage(Exception):
      def __init__(self):
        self.title = {"en": "Test"}
        self.description = {"en": "Desc"}
        # No image_url attribute
        super().__init__("Test")

    try:
      raise MockRecoveryPromptErrorNoImage()
    except MockRecoveryPromptErrorNoImage:
      info = phase_executor.ExceptionInfo(*sys.exc_info())

    result = info.as_base_types()
    self.assertIn('operator_popup', result)
    self.assertIsNone(result['operator_popup']['image_url'])
