# -*- coding: utf-8 -*- #
# Copyright 2019 Google LLC. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Create public delegated sub prefix command."""

from __future__ import absolute_import
from __future__ import division
from __future__ import unicode_literals

from googlecloudsdk.api_lib.compute import base_classes
from googlecloudsdk.api_lib.compute import public_delegated_prefixes
from googlecloudsdk.api_lib.compute import utils as compute_api
from googlecloudsdk.calliope import base
from googlecloudsdk.command_lib.compute import flags as compute_flags
from googlecloudsdk.command_lib.compute.public_delegated_prefixes import flags
from googlecloudsdk.command_lib.util.apis import arg_utils


DETAILED_HELP = {
    'EXAMPLES':
        """\
        To create a delegated sub prefix for a global public delegated prefix:

          $ {command} my-sub-prefix --range=120.120.10.128/28 --public-delegated-prefix=my-pdp --global-public-delegated-prefix

        To create a delegated sub prefix for a regional public delegated prefix:

          $ {command} my-sub-prefix --range=120.120.10.128/30 --create-addresses --public-delegated-prefix=my-pdp --public-delegated-prefix-region=us-east1
        """
}


@base.ReleaseTracks(base.ReleaseTrack.GA)
@base.UniverseCompatible
class Create(base.UpdateCommand):
  r"""Creates a Compute Engine delegated sub prefix."""

  detailed_help = DETAILED_HELP
  _api_version = compute_api.COMPUTE_GA_API_VERSION
  _include_internal_subnetwork_creation_mode = False

  @classmethod
  def Args(cls, parser):
    flags.AddCreateSubPrefixArgs(
        parser, cls._include_internal_subnetwork_creation_mode
    )

  def Run(self, args):
    holder = base_classes.ComputeApiHolder(self.ReleaseTrack())
    client = holder.client
    messages = holder.client.messages
    resources = holder.resources

    pdp_ref = flags.PUBLIC_DELEGATED_PREFIX_FLAG_ARG.ResolveAsResource(
        args,
        resources,
        scope_lister=compute_flags.GetDefaultScopeLister(holder.client))

    pdp_client = public_delegated_prefixes.PublicDelegatedPrefixesClient(
        client, messages, resources)
    if args.mode:
      input_mode = arg_utils.ChoiceToEnum(
          args.mode,
          holder.client.messages.PublicDelegatedPrefixPublicDelegatedSubPrefix.ModeValueValuesEnum,
      )
    else:
      input_mode = None

    return pdp_client.AddSubPrefix(
        pdp_ref,
        args.name,
        args.range,
        args.description,
        args.delegatee_project,
        args.create_addresses,
        input_mode,
        int(args.allocatable_prefix_length)
        if args.allocatable_prefix_length
        else None,
    )


@base.ReleaseTracks(base.ReleaseTrack.BETA)
class CreateBeta(Create):
  r"""Creates a Compute Engine delegated sub prefix."""

  _api_version = compute_api.COMPUTE_BETA_API_VERSION
  _include_internal_subnetwork_creation_mode = False


@base.ReleaseTracks(base.ReleaseTrack.ALPHA)
class CreateAlpha(CreateBeta):
  r"""Creates a Compute Engine delegated sub prefix."""

  _api_version = compute_api.COMPUTE_ALPHA_API_VERSION
  _include_internal_subnetwork_creation_mode = True
